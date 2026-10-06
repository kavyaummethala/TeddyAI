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
  if ("speechSynthesis" in window) speechSynthesis.cancel();
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
  speechSynthesis.cancel();
  let stopped = false;
  // Chrome cuts off long utterances, so speak sentence by sentence.
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) ?? [text];
  const [rate, pitch] = BROWSER_VOICE[phase];
  const voice = pickVoice();

  const done = new Promise<"completed" | "stopped">((resolve, reject) => {
    sentences.forEach((sentence, i) => {
      const u = new SpeechSynthesisUtterance(sentence.trim());
      if (voice) u.voice = voice;
      u.rate = rate;
      u.pitch = pitch;
      if (i === sentences.length - 1) u.onend = () => resolve(stopped ? "stopped" : "completed");
      u.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") resolve("stopped");
        else reject(new TtsError(e.error));
      };
      speechSynthesis.speak(u);
    });
  });

  return {
    stop() {
      stopped = true;
      speechSynthesis.cancel();
    },
    done,
  };
}
