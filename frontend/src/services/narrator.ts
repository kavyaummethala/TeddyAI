// Plays narration aloud. Server mode streams MP3 from /api/voice; browser mode uses speechSynthesis.
// Either way, narration slows down as the story moves into Wind Down Mode.

import type { StoryPhase } from "../../../shared/types";

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

/** tone "reply" = Teddy's quick, bright reactions ("Ooh, good one!"); "story" = narration. */
export type Tone = "story" | "reply";

export function narrate(text: string, phase: StoryPhase, mode: "server" | "browser", tone: Tone = "story"): Narration {
  return mode === "browser" ? narrateWithBrowser(text, phase, tone) : narrateWithServer(text, phase, tone);
}

/** Streams audio from the backend; the <audio> element starts playing as soon as bytes arrive. */
const streamUrl = (text: string, phase: StoryPhase, tone: Tone) =>
  `/api/voice/stream?${new URLSearchParams({ text, phase, tone })}`;

function narrateWithServer(text: string, phase: StoryPhase, tone: Tone): Narration {
  let resolveStopped: (v: "stopped") => void = () => {};

  const done = new Promise<"completed" | "stopped">((resolve, reject) => {
    resolveStopped = resolve;
    player.onended = () => resolve("completed");
    player.onerror = () => reject(new TtsError("Audio playback failed"));
    player.src = streamUrl(text, phase, tone);
    player.play().catch((err) => reject(new TtsError(err.message)));
  });

  return {
    stop() {
      player.onended = null;
      player.onerror = null;
      player.pause();
      player.removeAttribute("src"); // also cancels the download, so the server stops generating
      player.load();
      resolveStopped("stopped");
    },
    done,
  };
}

// Short, instant acknowledgments played the moment the child finishes talking, so they know
// Teddy heard them while the next part of the story is being written. After the first use,
// the browser caches each clip, so they play immediately.
// Warm and curious, and they fit anything a child might say: an idea, a choice, or a question.
const QUICK_REPLIES = {
  lively: ["Ooh!", "Ooh, let me think!", "Ooh, good one!", "Hmm, let's see!"],
  calm: ["Mmm, let's see.", "Ooh, okay, sweetie."],
};
/** What Teddy says when the child calls its name mid-story. */
const WAKE_REPLY = "Yes?";

export function quickReply(phase: StoryPhase, mode: "server" | "browser"): { text: string; narration: Narration } {
  const options = phase === "interactive" || phase === "settling" ? QUICK_REPLIES.lively : QUICK_REPLIES.calm;
  const text = options[Math.floor(Math.random() * options.length)];
  return { text, narration: narrate(text, phase, mode, "reply") };
}

/** Teddy answering to its name ("Teddy!" -> "Yes?"). */
export function wakeReply(phase: StoryPhase, mode: "server" | "browser"): Narration {
  return narrate(WAKE_REPLY, phase, mode, "reply");
}

/** Warm the browser cache so the first quick reply is instant too. */
export function preloadQuickReplies(mode: "server" | "browser") {
  if (mode !== "server") return;
  const all: [string, StoryPhase][] = [
    ...[...QUICK_REPLIES.lively, WAKE_REPLY].map((text): [string, StoryPhase] => [text, "interactive"]),
    ...[...QUICK_REPLIES.calm, WAKE_REPLY].map((text): [string, StoryPhase] => [text, "windDown"]),
  ];
  for (const [text, phase] of all) fetch(streamUrl(text, phase, "reply")).catch(() => {});
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

function narrateWithBrowser(text: string, phase: StoryPhase, tone: Tone): Narration {
  if (!("speechSynthesis" in window)) {
    return { stop() {}, done: Promise.reject(new TtsError("This browser cannot speak")) };
  }
  // Chrome bug: speak() right after cancel() is sometimes silently dropped, so only cancel if needed.
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  let stopped = false;
  // Chrome cuts off long utterances, so speak one sentence at a time.
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) ?? [text];
  const [rate, basePitch] = BROWSER_VOICE[phase];
  const pitch = tone === "reply" ? basePitch + 0.15 : basePitch; // brighter for quick reactions
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
