// Plays narration aloud. Server mode fetches MP3 from /api/voice; browser mode uses speechSynthesis.
// Either way, narration slows down as the story moves into Wind Down Mode.

import type { StoryPhase } from "../../../shared/types";
import { synthesizeSpeech } from "./api";

export class TtsError extends Error {}

export interface Narration {
  /** Stop speaking immediately (e.g. the child interrupted). */
  stop(): void;
  /** "completed" when it finished on its own, "stopped" if stop() was called. */
  done: Promise<"completed" | "stopped">;
}

// One shared <audio> element. Browsers only allow audio after a user gesture, so we
// "unlock" it on the first tap and reuse it for the rest of the story.
const player = new Audio();
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function unlockAudio() {
  player.src = SILENT_WAV;
  player.play().catch(() => {});
  // Safari/iOS only allow speech that was first started inside a tap, so speak a silent utterance now.
  if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}

export function narrate(text: string, phase: StoryPhase, mode: "server" | "browser"): Narration {
  return mode === "browser" ? narrateWithBrowser(text, phase) : narrateWithServer(text, phase);
}

function narrateWithServer(text: string, phase: StoryPhase): Narration {
  let stopped = false;
  let resolveStopped: (v: "stopped") => void = () => {};

  const done = new Promise<"completed" | "stopped">((resolve, reject) => {
    resolveStopped = resolve;
    synthesizeSpeech(text, phase)
      .then((blob) => {
        if (stopped) return;
        const url = URL.createObjectURL(blob);
        player.src = url;
        player.onended = () => {
          URL.revokeObjectURL(url);
          resolve("completed");
        };
        player.onerror = () => reject(new TtsError("Audio playback failed"));
        return player.play();
      })
      .catch((err) => {
        if (!stopped) reject(new TtsError(err.message));
      });
  });

  return {
    stop() {
      stopped = true;
      player.pause();
      player.onended = null;
      resolveStopped("stopped");
    },
    done,
  };
}

const BROWSER_VOICE = { interactive: [0.95, 1.05], settling: [0.9, 1.0], windDown: [0.82, 0.95], ending: [0.78, 0.92] };

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  // Prefer the more natural-sounding voices when the OS/browser has them.
  const preferred = ["Samantha", "Google UK English Female", "Google US English", "Microsoft Aria", "Karen", "Moira"];
  for (const name of preferred) {
    const voice = voices.find((v) => v.name.includes(name));
    if (voice) return voice;
  }
  return voices[0];
}

function narrateWithBrowser(text: string, phase: StoryPhase): Narration {
  if (!("speechSynthesis" in window)) {
    return { stop() {}, done: Promise.reject(new TtsError("This browser cannot speak")) };
  }
  // Chrome bug: speak() right after cancel() is sometimes silently dropped, so only cancel if needed.
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  let stopped = false;
  // Chrome cuts off long utterances, so speak one sentence at a time.
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) ?? [text];
  const [rate, pitch] = BROWSER_VOICE[phase];
  const voice = pickVoice();

  const done = new Promise<"completed" | "stopped">((resolve, reject) => {
    const speakNext = (i: number) => {
      if (stopped) return resolve("stopped");
      if (i >= sentences.length) return resolve("completed");
      const u = new SpeechSynthesisUtterance(sentences[i].trim());
      currentUtterance = u; // Chrome bug: unreferenced utterances get garbage-collected and never fire onend
      if (voice) u.voice = voice;
      u.rate = rate;
      u.pitch = pitch;
      u.onend = () => speakNext(i + 1);
      u.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") resolve("stopped");
        else reject(new TtsError(e.error));
      };
      speechSynthesis.speak(u);
      speechSynthesis.resume(); // Chrome can get stuck "paused" after the tab was in the background
    };
    speakNext(0);
  });

  return {
    stop() {
      stopped = true;
      speechSynthesis.cancel();
    },
    done,
  };
}

let currentUtterance: SpeechSynthesisUtterance | null = null;
