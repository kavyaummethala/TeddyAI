// Captures one utterance from the child and returns the transcript ("" = nothing heard).
//
// Server mode: MediaRecorder + a voice-activity detector (voiceActivity.ts) that stops
//   recording automatically once the child stops talking, then sends the audio to /api/speech.
// Browser mode: Chrome's built-in Web Speech API (free, no key needed).

import { transcribeAudio } from "./api";
import { VoiceActivityDetector } from "./voiceActivity";

export class MicError extends Error {}

export interface Listening {
  /** Finish now and transcribe whatever was said. */
  stop(): void;
  /** Abort without transcribing; result resolves to "". */
  cancel(): void;
  result: Promise<string>;
}

interface ListenOptions {
  mode: "server" | "browser";
  /** 0..1 microphone level, for the listening animation. */
  onLevel?: (level: number) => void;
  /** Give up if no speech starts within this time (child may be drifting off). */
  noSpeechTimeoutMs?: number;
}

export function listen(opts: ListenOptions): Listening {
  return opts.mode === "browser" ? listenWithWebSpeech() : listenWithRecorder(opts);
}

// ---------- Server transcription (MediaRecorder + simple VAD) ----------

let micStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;

/** Ask for the mic once and reuse the stream, so the child isn't prompted every turn. */
async function getMic(): Promise<MediaStream> {
  if (micStream?.active) return micStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return micStream;
  } catch {
    throw new MicError("Microphone unavailable");
  }
}

/** Ask for the microphone early (when the parent taps Start), so the permission prompt doesn't land on the child. */
export function warmUpMic() {
  getMic().catch(() => {});
}

function pickMimeType(): string | undefined {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return types.find((t) => MediaRecorder.isTypeSupported(t));
}

function listenWithRecorder({ onLevel, noSpeechTimeoutMs = 8000 }: ListenOptions): Listening {
  let finish: ((transcribe: boolean) => void) | null = null;
  let pending: boolean | null = null; // stop()/cancel() called before the mic was ready

  const result = (async () => {
    const stream = await getMic();
    audioContext ??= new AudioContext();
    await audioContext.resume();

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    const vad = new VoiceActivityDetector({ noSpeechTimeoutMs });
    let lastTick = performance.now();
    let shouldTranscribe = true;

    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    let isDone = false;
    const done = (transcribe: boolean) => {
      if (isDone) return;
      isDone = true;
      shouldTranscribe = transcribe;
      clearInterval(timer);
      source.disconnect();
      onLevel?.(0);
      if (recorder.state !== "inactive") recorder.stop();
    };

    // Sample the mic volume every 50ms and let the voice-activity detector decide when to stop.
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
      const now = performance.now();
      const state = vad.update(rms, now - lastTick);
      lastTick = now;
      onLevel?.(Math.min(1, rms * 12));
      if (state === "done") done(true);
      else if (state === "no_speech") done(false);
    }, 50);

    recorder.start();
    finish = done;
    if (pending !== null) done(pending);

    await stopped;
    // Manual stop() counts as speech even if the VAD missed it (quiet voices).
    if (!shouldTranscribe || chunks.length === 0) return "";
    const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    return transcribeAudio(audio);
  })();

  const end = (transcribe: boolean) => (finish ? finish(transcribe) : (pending = transcribe));
  return { stop: () => end(true), cancel: () => end(false), result };
}

// ---------- Browser transcription (Web Speech API) ----------

function listenWithWebSpeech(): Listening {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Recognition) {
    return {
      stop() {},
      cancel() {},
      result: Promise.reject(new MicError("Speech recognition needs Chrome, or add a GROQ_API_KEY")),
    };
  }

  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;
  let transcript = "";
  let cancelled = false;

  const result = new Promise<string>((resolve, reject) => {
    recognition.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
    };
    recognition.onerror = (e: { error: string }) => {
      if (e.error === "not-allowed" || e.error === "audio-capture") reject(new MicError(e.error));
    };
    recognition.onend = () => resolve(cancelled ? "" : transcript.trim());
  });
  recognition.start();

  return {
    stop: () => recognition.stop(),
    cancel: () => {
      cancelled = true;
      recognition.abort();
    },
    result,
  };
}
