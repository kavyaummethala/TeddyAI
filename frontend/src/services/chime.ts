// Tiny sound cues, made with the Web Audio API (no audio files): a soft rising "ding-ding" when
// Teddy starts listening and a falling one when it heard the child. Children learn these quickly,
// so they know when it's their turn to talk without reading anything.

import type { StoryPhase } from "../../../shared/types";

let ctx: AudioContext | null = null;

/** Call during a tap so the browser allows sound later. */
export function warmUpChimes() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    // no Web Audio: chimes are a nice-to-have
  }
}

const NOTES = {
  listen: [523.25, 659.25], // C5 -> E5: "your turn"
  heard: [659.25, 523.25], // E5 -> C5: "got it"
};

/** Plays a cue and resolves when it has finished (so recording doesn't pick it up). */
export function chime(kind: keyof typeof NOTES, phase: StoryPhase): Promise<void> {
  if (!ctx || ctx.state !== "running") return Promise.resolve();
  const volume = phase === "windDown" || phase === "ending" ? 0.05 : 0.09; // quieter near sleep
  const now = ctx.currentTime;
  NOTES[kind].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.13;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(start);
    osc.stop(start + 0.26);
  });
  return new Promise((resolve) => setTimeout(resolve, 420));
}
