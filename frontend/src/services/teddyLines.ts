// Everything Teddy says that isn't part of the story itself. Young children can't read, so every
// instruction and every problem is spoken out loud, not just shown on screen.

import type { StoryState } from "../../../shared/types";
import { listNames } from "./format";

/** The first thing the child hears when the story screen opens. */
export function greeting(state: StoryState, wakeWord: boolean): string {
  const names = listNames(state.children.map((c) => c.name));
  const tip = wakeWord ? " If you want to tell me something during the story, just say, Teddy!" : "";
  if (state.storyRequest) {
    return `Hi ${names}! I'm Teddy. Tonight I have a story for you about ${state.storyRequest.replace(/[.!?]+$/, "")}.${tip} Ready? Let's begin.`;
  }
  const ideas = [...new Set(state.children.flatMap((c) => c.interests))].slice(0, 2);
  const examples = ideas.length ? ` Maybe ${ideas.join(", or ")}?` : " Maybe a dragon, or a rocket?";
  return `Hi ${names}! I'm Teddy, and I'm going to tell you a bedtime story. What should it be about?${examples} Or anything you like!`;
}

/** After the child picks the story (or stays quiet), while the opening is being written. */
export function firstReply(heardSomething: boolean, wakeWord: boolean): string {
  const start = heardSomething ? "Ooh, fun!" : "That's okay! I'll pick a story for you.";
  return wakeWord ? `${start} And if you want to tell me something during the story, just say, Teddy!` : start;
}

export const LINES = {
  didntCatch: "Hmm, I didn't catch that. Can you say it again?",
  keepGoing: "That's okay! Let's keep going with our story.",
  tangled: "Oops, my story got a little tangled. A grown-up can help me try again.",
};
