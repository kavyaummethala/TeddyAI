// The story engine: StoryState + the child's words in, next narration segment + new StoryState out.
// It owns pacing decisions (phase, whether a question is allowed) so the model can't stretch
// the story forever or keep the child talking at bedtime.
//
// Two steps: before the first segment, a PLANNER call outlines the story (hero, the hero's version of
// what's on the child's mind, and beats with an emotional arc). Every segment after that is a
// NARRATOR call that tells the next beat.

import type { StoryPlan, StorySegment, StoryState, TurnEvent } from "../../../shared/types";
import { config } from "../config";
import { applyUpdate, questionAllowed, type StoryUpdate } from "../models/storyState";
import { buildTurnPrompt, SYSTEM_PROMPT } from "../prompts/bedtimeStoryPrompt";
import { ageStyle } from "../prompts/ageStyle";
import { beatCount, buildPlanPrompt, PLANNER_SYSTEM } from "../prompts/storyPlanPrompt";
import { measureReadingLevel, tooHard } from "./readability";
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
  acknowledged?: string,
): Promise<StoryTurnResult> {
  if (state.finished) throw new Error("This story has already finished.");

  // Step 1 (first segment only): plan the story around the child's request and the parent's concern.
  if (!state.story.plan && config.llm.provider !== "mock") {
    const plan = await planStory(state, transcript);
    if (plan) state = { ...state, story: { ...state.story, plan } };
  }

  // "Finish story" jumps straight to the ending, whatever the pacing says.
  const phase = event === "wrap_up" ? "ending" : state.pacing.phase;
  const canAsk = questionAllowed(state);
  const prompt = buildTurnPrompt(state, transcript, event, phase, canAsk, acknowledged);

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
  const childSpoke = (event === "child_spoke" || event === "interrupted") && transcript.trim().length > 0;
  if (!childSpoke) update.childWantsToEnd = false; // only the child can end the story early
  if (!canAsk) update.askForResponse = false;
  if (phase === "windDown" || phase === "ending" || update.childWantsToEnd) update.askForResponse = false;

  // Enforce the age's reading level in code: if the segment came back too hard, rewrite it simpler.
  if (config.llm.provider !== "mock") update.narration = await simplifyIfNeeded(state, update.narration);

  // The last segment always closes the way bedtime stories do, so the child knows it's over.
  const ending = phase === "ending" || update.childWantsToEnd || event === "wrap_up";
  if (ending && !/the end/i.test(update.narration)) update.narration = `${update.narration.trim()} The end. Goodnight.`;

  // The app already said a quick "Ooh!" out loud; don't let the narration open with another one.
  if (acknowledged) update.narration = stripLeadingInterjection(update.narration);

  const nextState = applyUpdate(state, phase, update, childSpoke);

  return {
    state: nextState,
    segment: {
      narration: update.narration,
      askForResponse: update.askForResponse,
      phase: update.childWantsToEnd ? "ending" : phase,
      finished: nextState.finished,
    },
  };
}

const SIMPLIFY_SYSTEM = `You rewrite one part of a bedtime story so a young child can easily follow it when it's read aloud.
Keep exactly the same events, characters, names, dialogue meaning, and order. Keep the past tense. If it ends with a question to the child, end with the same question.
Use shorter sentences and everyday words a young child already knows. Replace any hard word with a simple one.
It must still sound like a warm, real storybook: complete, grammatical sentences with a natural rhythm. Never chop it into broken fragments like "He felt dark." or "She smiled tiny."
Reply with ONLY JSON: {"narration": string}`;

/**
 * Checks the segment against the youngest listener's reading-level limits and, if it's too hard,
 * asks for a simpler rewrite. Keeps the original if the rewrite fails or isn't actually simpler.
 */
async function simplifyIfNeeded(state: StoryState, narration: string): Promise<string> {
  const youngest = Math.min(...state.children.map((c) => c.age));
  const { limits, label, guide } = ageStyle(youngest);
  if (!limits) return narration;

  const ignore = [
    ...state.children.flatMap((c) => [c.name, ...c.interests]),
    ...state.story.characters,
    state.story.plan?.hero ?? "",
  ];
  const before = measureReadingLevel(narration, ignore);
  if (!tooHard(before, limits)) return narration;

  try {
    const prompt = `Reader: ${label}. Keep sentences under about ${limits.maxAvgSentenceWords} words, but complete and natural.
${before.hardWords.length ? `Hard words to replace: ${before.hardWords.join(", ")}.
` : ""}Style guide:
${guide}

TEXT TO REWRITE:
${narration}`;
    const raw = await generateText(SIMPLIFY_SYSTEM, prompt, "low", "small");
    const simpler = parseStoryUpdate(raw).narration;
    const after = measureReadingLevel(simpler, ignore);
    // A question to the child must survive the rewrite.
    const keptQuestion = !endsWithQuestion(narration) || endsWithQuestion(simpler);
    const better =
      after.avgSentenceWords < before.avgSentenceWords || after.hardWordPercent < before.hardWordPercent;
    // Much shorter than needed means it was chopped into fragments: keep the original instead.
    const choppy = after.avgSentenceWords < limits.maxAvgSentenceWords * 0.45;
    if (keptQuestion && better && !choppy) {
      console.log(
        `[storyEngine] simplified for ${label}: ${before.avgSentenceWords.toFixed(1)} -> ${after.avgSentenceWords.toFixed(1)} words/sentence, ` +
          `hard words ${before.hardWordPercent.toFixed(1)}% -> ${after.hardWordPercent.toFixed(1)}%`,
      );
      return simpler;
    }
  } catch (err) {
    console.warn("[storyEngine] simplify pass failed, keeping original:", (err as Error).message);
  }
  return narration;
}

/** Writes the story outline. Returns undefined if planning fails (the story still works, just less shaped). */
async function planStory(state: StoryState, childRequest: string): Promise<StoryPlan | undefined> {
  try {
    const raw = await generateText(PLANNER_SYSTEM, buildPlanPrompt(state, childRequest.trim()), "medium");
    const cleaned = raw.replace(/```(?:json)?/gi, "");
    const obj = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const beats = (Array.isArray(obj.beats) ? obj.beats : [])
      .map((b: { happens?: unknown; heroFeels?: unknown }) => ({ happens: text(b?.happens), heroFeels: text(b?.heroFeels) }))
      .filter((b: { happens: string }) => b.happens)
      .slice(0, beatCount(state.pacing.targetDurationMinutes) + 1);
    if (!text(obj.hero) || beats.length < 2) throw new Error("plan missing hero or beats");
    return { hero: text(obj.hero), heroWorry: text(obj.heroWorry), goal: text(obj.goal), comfort: text(obj.comfort), beats };
  } catch (err) {
    console.warn("[storyEngine] planning failed, narrating without a plan:", (err as Error).message);
    return undefined;
  }
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
    beatDone: obj.beatDone === true,
    // Only wait for an answer if the narration really asks one near the end: the flag alone isn't trusted.
    askForResponse: endsWithQuestion(narration),
    childWantsToEnd: obj.childWantsToEnd === true,
  };
}

/** "Oh! I love that!" -> "I love that!" (only strips short exclamations like Oh/Ooh/Hmm/Okay). */
export function stripLeadingInterjection(narration: string): string {
  const stripped = narration.replace(/^\s*(?:(?:oh+|o+h+|hmm+|mm+|okay|ok|wow|yay)\b[\s,!.…-]*)+/i, "");
  if (stripped.length < 10) return narration; // never strip the whole thing
  return stripped[0].toUpperCase() + stripped.slice(1);
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
