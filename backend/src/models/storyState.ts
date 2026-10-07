// StoryState creation, pacing, and updates. Pure functions — no I/O — so they're easy to reason about.

import type { ParentSetup, StoryPhase, StoryState } from "../../../shared/types";
import { pickSpark } from "../prompts/storySparks";

/** Bedtime narration is slow; ~130 spoken words per minute. */
const WORDS_PER_MINUTE = 130;
/** Rough time the child spends listening/answering per interaction. */
const MINUTES_PER_INTERACTION = 0.25;

const PHASE_ORDER: StoryPhase[] = ["interactive", "settling", "windDown", "ending"];

export function createInitialState(setup: ParentSetup): StoryState {
  const recentStories = setup.recentStories?.length ? setup.recentStories : undefined;
  return {
    children: setup.children,
    parentGoal: setup.parentGoal || undefined,
    storyRequest: setup.storyRequest || undefined,
    recentStories,
    // Don't suggest a hero named after a listener, or one from a recent story.
    spark: pickSpark([...setup.children.map((c) => c.name), ...(recentStories ?? [])]),
    story: {
      characters: [],
      summary: "",
      currentScene: "",
      importantEvents: [],
      childChanges: [],
      plan: [],
      recentNarrations: [],
    },
    pacing: {
      targetDurationMinutes: setup.durationMinutes,
      elapsedMinutes: 0,
      phase: "interactive",
      segmentCount: 0,
      wordsNarrated: 0,
      segmentsSinceQuestion: 0,
    },
    interactionCount: 0,
    finished: false,
  };
}

/**
 * Wind Down Mode: the phase comes from estimated progress through the requested duration.
 *   0–35% interactive · 35–65% settling · 65–90% windDown · 90%+ ending
 * The phase never moves backwards, and a segment cap guarantees the story always ends.
 */
export function phaseForProgress(state: StoryState): StoryPhase {
  const { elapsedMinutes, targetDurationMinutes, segmentCount, phase } = state.pacing;
  const progress = elapsedMinutes / targetDurationMinutes;

  let next: StoryPhase =
    progress >= 0.9 ? "ending" : progress >= 0.65 ? "windDown" : progress >= 0.35 ? "settling" : "interactive";

  // Hard stop: even if the model writes very short segments, never run forever.
  const maxSegments = Math.round(targetDurationMinutes * 1.5) + 3;
  if (segmentCount >= maxSegments) next = "ending";

  return PHASE_ORDER.indexOf(next) > PHASE_ORDER.indexOf(phase) ? next : phase;
}

/** Target narration length per segment: short and lively early, longer and slower later. */
export const WORDS_PER_PHASE: Record<StoryPhase, [number, number]> = {
  interactive: [50, 90],
  settling: [90, 140],
  windDown: [110, 160],
  ending: [80, 130],
};

/**
 * Whether the storyteller may ask the child something this turn.
 * Roughly one question every 1–2 minutes early on, rarely while settling, never after that.
 */
export function questionAllowed(state: StoryState): boolean {
  const { phase, segmentsSinceQuestion, segmentCount } = state.pacing;
  if (segmentCount === 0) return false; // let the opening breathe
  if (phase === "interactive") return segmentsSinceQuestion >= 1;
  // Short stories (handy for testing) still get a choice or two.
  if (phase === "settling") return segmentsSinceQuestion >= (state.pacing.targetDurationMinutes <= 3 ? 1 : 3);
  return false;
}

/** What the story engine extracts from the model's JSON reply. */
export interface StoryUpdate {
  narration: string;
  title?: string;
  characters?: string[];
  setting?: string;
  summary?: string;
  currentScene?: string;
  importantEvent?: string;
  childChange?: string;
  askForResponse: boolean;
  /** The plot plan, written once in the opening segment. */
  plan?: string[];
  /** The child said they're done / sleepy, so this segment is the ending. */
  childWantsToEnd?: boolean;
}

/** Returns a NEW state with the segment applied (the input is never mutated). */
export function applyUpdate(
  prev: StoryState,
  phaseUsed: StoryPhase,
  update: StoryUpdate,
  childSpoke: boolean,
): StoryState {
  const words = update.narration.split(/\s+/).filter(Boolean).length;
  const interactionCount = prev.interactionCount + (childSpoke ? 1 : 0);
  const wordsNarrated = prev.pacing.wordsNarrated + words;

  const next: StoryState = {
    ...prev,
    story: {
      title: update.title || prev.story.title,
      characters: update.characters?.length ? update.characters : prev.story.characters,
      setting: update.setting || prev.story.setting,
      summary: update.summary || prev.story.summary,
      currentScene: update.currentScene || prev.story.currentScene,
      importantEvents: update.importantEvent
        ? [...prev.story.importantEvents, update.importantEvent].slice(-12)
        : prev.story.importantEvents,
      childChanges: update.childChange
        ? [...prev.story.childChanges, update.childChange]
        : prev.story.childChanges,
      plan: prev.story.plan.length ? prev.story.plan : (update.plan ?? []).slice(0, 6),
      recentNarrations: [...prev.story.recentNarrations, update.narration].slice(-3),
    },
    pacing: {
      ...prev.pacing,
      phase: phaseUsed,
      segmentCount: prev.pacing.segmentCount + 1,
      wordsNarrated,
      elapsedMinutes: round(wordsNarrated / WORDS_PER_MINUTE + interactionCount * MINUTES_PER_INTERACTION),
      segmentsSinceQuestion: update.askForResponse ? 0 : prev.pacing.segmentsSinceQuestion + 1,
    },
    interactionCount,
    // Pacing decides when the story ends, unless the child asked to stop.
    finished: phaseUsed === "ending" || !!update.childWantsToEnd,
  };

  // Advance the phase for the *next* turn based on the new elapsed estimate.
  next.pacing.phase = next.finished ? phaseUsed : phaseForProgress(next);
  return next;
}

const round = (n: number) => Math.round(n * 10) / 10;
