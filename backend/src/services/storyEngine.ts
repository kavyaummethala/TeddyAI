// The story engine: StoryState + the child's words in, next narration segment + new StoryState out.
// It owns pacing decisions (phase, whether a question is allowed) so the model can't stretch
// the story forever or keep the child talking at bedtime.

import type { StorySegment, StoryState, TurnEvent } from "../../../shared/types";
import { config } from "../config";
import { applyUpdate, questionAllowed, type StoryUpdate } from "../models/storyState";
import { buildTurnPrompt, SYSTEM_PROMPT } from "../prompts/bedtimeStoryPrompt";
import { generateText } from "./llm";
import { mockStoryReply } from "./mockStory";

export interface StoryTurnResult {
  state: StoryState;
  segment: StorySegment;
}

export async function nextSegment(
  state: StoryState,
  transcript: string,
  event: TurnEvent,
): Promise<StoryTurnResult> {
  if (state.finished) throw new Error("This story has already finished.");

  const phase = state.pacing.phase;
  const canAsk = questionAllowed(state);
  const prompt = buildTurnPrompt(state, transcript, event, phase, canAsk);

  // One retry covers most transient failures and the occasional malformed JSON reply.
  let update: StoryUpdate | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2 && !update; attempt++) {
    try {
      const raw =
        config.llm.provider === "mock"
          ? mockStoryReply(state, transcript, phase, canAsk)
          : await generateText(SYSTEM_PROMPT, prompt);
      update = parseStoryUpdate(raw);
    } catch (err) {
      lastError = err;
      console.warn(`[storyEngine] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  if (!update) throw lastError ?? new Error("Story engine failed");

  // Enforce pacing rules regardless of what the model returned.
  if (!canAsk) update.askForResponse = false;
  if (phase === "windDown" || phase === "ending") update.askForResponse = false;

  const childSpoke = (event === "child_spoke" || event === "interrupted") && transcript.trim().length > 0;
  const nextState = applyUpdate(state, phase, update, childSpoke);

  return {
    state: nextState,
    segment: {
      narration: update.narration,
      askForResponse: update.askForResponse,
      phase,
      finished: nextState.finished,
    },
  };
}

/**
 * Tolerant JSON parsing: strips ```json fences, finds the outermost {...}, and validates fields.
 * If the model ignored JSON entirely but wrote a story, we still use that text as narration
 * rather than failing the turn.
 */
export function parseStoryUpdate(raw: string): StoryUpdate {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  let obj: Record<string, unknown> | null = null;
  if (start !== -1 && end > start) {
    try {
      obj = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      obj = null;
    }
  }

  if (!obj) {
    // Fallback: plain prose that looks like narration.
    if (cleaned.length > 40 && !cleaned.includes("{")) {
      const narration = cleanNarration(cleaned);
      return { narration, askForResponse: endsWithQuestion(narration) };
    }
    throw new Error("Model reply was not valid JSON");
  }

  const narration = typeof obj.narration === "string" ? cleanNarration(obj.narration) : "";
  if (narration.length < 10) throw new Error("Model reply had no narration");

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const strList = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : undefined;

  return {
    narration,
    title: str(obj.title),
    characters: strList(obj.characters),
    setting: str(obj.setting),
    summary: str(obj.summary),
    currentScene: str(obj.currentScene),
    importantEvent: str(obj.importantEvent),
    childChange: str(obj.childChange),
    // Only wait for an answer if the narration really asks one near the end: the flag alone isn't trusted.
    askForResponse: endsWithQuestion(narration),
  };
}

/** True if one of the last two sentences is a question. */
function endsWithQuestion(narration: string): boolean {
  const sentences = narration.match(/[^.!?]+[.!?]+["'”’)]*/g) ?? [narration];
  return sentences.slice(-2).some((s) => /\?["'”’)]*$/.test(s.trim()));
}

/** Removes markup that would sound odd when spoken aloud. */
function cleanNarration(text: string): string {
  return text
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
