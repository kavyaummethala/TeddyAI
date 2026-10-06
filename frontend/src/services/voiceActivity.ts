// Decides when the child has started and finished talking, from microphone volume (RMS) alone.
// Pure logic with no browser APIs, so it can be unit-tested with fake volume data.
//
// Two adaptive levels instead of fixed thresholds:
//  - noise floor: tracks the quietest recent level (room noise), creeping up only slowly,
//    so it can't be "calibrated" to the child's voice if they start talking immediately;
//  - speech peak: the loudest level heard, so "silence" means "much quieter than the child
//    was talking", even in a noisy room.

export type VadState = "waiting" | "speaking" | "done" | "no_speech";

export interface VadOptions {
  silenceAfterSpeechMs?: number;
  noSpeechTimeoutMs?: number;
  maxUtteranceMs?: number;
}

export class VoiceActivityDetector {
  private floor = Infinity;
  private peak = 0;
  private speechMs = 0;
  private quietMs = 0;
  private startedSpeaking = false;
  private elapsed = 0;
  private readonly silenceAfterSpeechMs: number;
  private readonly noSpeechTimeoutMs: number;
  private readonly maxUtteranceMs: number;

  constructor(opts: VadOptions = {}) {
    this.silenceAfterSpeechMs = opts.silenceAfterSpeechMs ?? 1000;
    this.noSpeechTimeoutMs = opts.noSpeechTimeoutMs ?? 8000;
    this.maxUtteranceMs = opts.maxUtteranceMs ?? 12000;
  }

  get hasSpeech() {
    return this.startedSpeaking;
  }

  /** Feed one volume reading covering `frameMs` of audio. Returns the current state. */
  update(rms: number, frameMs: number): VadState {
    this.elapsed += frameMs;

    // Noise floor: drop instantly to quieter levels, rise very slowly toward louder ones.
    this.floor = rms < this.floor ? rms : this.floor + (rms - this.floor) * 0.005;
    const speechThreshold = Math.max(0.006, this.floor * 3);

    if (!this.startedSpeaking) {
      // Need ~150ms of sound clearly above the room noise to count as speech.
      this.speechMs = rms > speechThreshold ? this.speechMs + frameMs : 0;
      if (this.speechMs >= 150) this.startedSpeaking = true;
      if (this.startedSpeaking) this.peak = rms;
      else if (this.elapsed >= this.noSpeechTimeoutMs) return "no_speech";
      return this.startedSpeaking ? "speaking" : "waiting";
    }

    this.peak = Math.max(this.peak, rms);
    // "Quiet" = well below how loud the child was talking, or back near the room noise.
    const quietLevel = Math.max(this.floor * 2, this.peak * 0.18);
    this.quietMs = rms < quietLevel ? this.quietMs + frameMs : 0;

    if (this.quietMs >= this.silenceAfterSpeechMs) return "done";
    if (this.elapsed >= this.maxUtteranceMs) return "done";
    return "speaking";
  }
}
