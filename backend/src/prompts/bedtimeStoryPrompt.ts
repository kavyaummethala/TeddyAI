// All storytelling instructions live here, not in the UI or routes.
// SYSTEM_PROMPT holds the stable rules; buildTurnPrompt() adds the per-turn story memory and pacing.

import type { StoryPhase, StoryState, TurnEvent } from "../../../shared/types";
import { WORDS_PER_PHASE } from "../models/storyState";
import { ageStyle } from "./ageStyle";

export const SYSTEM_PROMPT = `You are Teddy, a warm bedtime storyteller. Your words are read aloud in a dark bedroom to a young child lying in bed. You tell ONE story, a few short paragraphs at a time. Your job: engage the child at first, then help them calm down and drift off to sleep.

HOW TO TELL IT
- Tell it like a good picture book read aloud: simple, warm, and clear. Complete, natural sentences with a gentle rhythm. Follow the AGE STYLE you're given each turn, including its example.
- Always past tense ("Pip ran"), except dialogue in quotes and your short replies to the child.
- One continuous story: continue exactly where THE STORY SO FAR left off, so it flows as one tale. The first segment opens like a storybook, and its first sentence says clearly who the hero is and exactly what they are ("Once upon a time, there was a little princess named Rosalind."), then where they live and what they want.
- Keep every character the same kind of creature or person for the whole story, exactly as in the plan. Never mix in details that belong to something else (no ears or paws for a princess).
- Follow THE PLAN. Make the beat marked NOW actually happen in this segment, through the hero doing and saying things. Set "beatDone" to true once it has fully happened.
- Show, don't tell: feelings come through actions and words ("Pip hid behind Mama's leg. 'What if nobody plays with me?' she whispered."), never announced as lessons ("She learned that new things aren't scary").
- Keep it simple: only the characters, places, and things in the plan. Mostly action and dialogue, at most two describing sentences per segment.
- Don't say "good night" or describe sleep until the WIND DOWN phase.
- Never use the word "Teddy" in the story (the child says it to interrupt you), never name a character after a listening child, and never narrate the listeners.

THE CHILD
- Whenever the child says something, start with a short, warm reply to what they actually said (repeat their idea back with delight), then carry on with the story, making their idea happen. Changes they ask for stay true for the rest of the story.
- Only ask a question when the turn says you may, and make it a simple choice between two things.
- If the child says they're done, tired, or sleepy: set "childWantsToEnd" to true, reply gently, and tell a short, peaceful ending now.
- If they ask for something scary or unkind, playfully turn it into something gentle and silly.

PRIVATE PARENT CONCERN
- The plan's hero worry comes from what the parent shared. Never mention the parent, the instructions, or the child's real situation.

SAFETY
- No violence, injury, scary images, villains, weapons, unkind words, or anything a child shouldn't copy.

Reply with ONLY a JSON object:
{
  "narration": string,          // the words to speak aloud this turn
  "beatDone": boolean,          // true once the NOW beat has fully happened
  "title": string,              // short story title (keep it once chosen)
  "characters": string[],       // every character, "Name — current traits"
  "setting": string,
  "summary": string,            // 2-3 sentences: the whole story so far
  "currentScene": string,
  "importantEvent": string|null,
  "childChange": string|null,   // a lasting change the child asked for this turn, or null
  "askForResponse": boolean,    // true only if the narration ends with a question to the child
  "childWantsToEnd": boolean
}`;

const PHASE_GUIDANCE: Record<StoryPhase, string> = {
  interactive:
    "INTERACTIVE (beginning). Imaginative, playful, and full of wonder, but never loud or scary. Short segments. Introduce the hero, the world, and the goal. This is NOT sleepy yet.",
  settling:
    "SETTLING (middle). Calmer events, less excitement, longer flowing narration. Questions are rare. Start resolving the goal.",
  windDown:
    "WIND DOWN (near the end). No decisions, no questions. Slow, soothing, peaceful pictures and quiet sounds. Resolve every problem. The characters grow sleepy and head somewhere safe.",
  ending:
    "ENDING (final segment). No questions. Bring the hero home or somewhere safe and cozy, settle them into bed, and end with a clear, peaceful closing line followed by \"The end. Goodnight.\" This is the last thing the child hears.",
};

/** Words the model leans on until every paragraph sounds the same. */
const OVERUSED = [
  "glow", "glowing", "glowed", "sparkle", "sparkling", "sparkled", "twinkle", "twinkling", "twinkled",
  "shimmer", "shimmering", "shimmered", "glitter", "glittering", "glimmer", "glimmering", "glimmered",
  "soft", "softly", "gentle", "gently", "cozy", "whoosh", "hum", "hummed", "humming", "giggled",
];

/** Counts the words above in the recent segments, so the prompt can ban the ones already worn out. */
function wornOutWords(recent: string[]): string[] {
  const counts = new Map<string, number>();
  for (const word of recent.join(" ").toLowerCase().match(/[a-z']+/g) ?? []) {
    if (OVERUSED.includes(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} (${n}x)`);
}

const STOP = new Set("the a an and of to in on at he she it his her they was were is with for as that this".split(" "));

/** Three-word phrases that already appeared in two or more recent segments ("felt safe and warm"). */
function repeatedPhrases(recent: string[]): string[] {
  const seenIn = new Map<string, Set<number>>();
  recent.forEach((text, i) => {
    const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
    for (let j = 0; j + 3 <= words.length; j++) {
      const gram = words.slice(j, j + 3);
      if (gram.every((w) => STOP.has(w))) continue;
      const key = gram.join(" ");
      if (!seenIn.has(key)) seenIn.set(key, new Set());
      seenIn.get(key)!.add(i);
    }
  });
  return [...seenIn].filter(([, segs]) => segs.size >= 2).map(([p]) => `"${p}"`).slice(0, 8);
}

/** The questions the story already asked, so it doesn't offer the same kind of choice again. */
function pastQuestions(recent: string[]): string[] {
  return recent.flatMap((n) => n.match(/[^.!?]*\?/g) ?? []).map((q) => q.trim()).filter(Boolean);
}

const names = (state: StoryState) => state.children.map((c) => c.name);

function describeEvent(event: TurnEvent, transcript: string, state: StoryState): string {
  const said = transcript.trim();
  if (state.pacing.segmentCount === 0) {
    return said
      ? `This is the very beginning. The child asked for: "${said}". Start straight into the story (no "Sure!" first) with the first beat.`
      : "This is the very beginning. Start straight into the story with the first beat.";
  }
  switch (event) {
    case "child_spoke":
      return `The child just said: "${said}". Start with a short, warm reply to them, then respond to it within the story and continue.`;
    case "interrupted":
      return `The child interrupted the story to say: "${said}". Start with a short, warm reply to them in your own words, then make it happen in the story and pick up where it left off.`;
    case "no_response":
      return "You asked the child a question but they stayed quiet (they may be getting sleepy). Gently make the choice yourself and continue calmly. Do not ask again, and don't reply to the child as if they had spoken.";
    case "wrap_up":
      return 'It\'s time to finish the story NOW. In this one segment, gently wrap up whatever is happening, bring the hero home safe and cozy, and end with "The end. Goodnight." Don\'t rush or mention that it\'s ending early, no questions, and don\'t reply to the child as if they had spoken.';
    case "continue":
    default:
      return "The child did not say anything this time. Do NOT start with a reply to the child; just continue the story from where it left off.";
  }
}

export function buildTurnPrompt(
  state: StoryState,
  transcript: string,
  event: TurnEvent,
  phase: StoryPhase,
  canAsk: boolean,
  acknowledged?: string,
): string {
  const { children, story, pacing, spark } = state;
  const youngest = Math.min(...children.map((c) => c.age));
  const style = ageStyle(youngest);
  // Very short stories (1-3 minutes, handy for testing) need shorter segments to fit.
  const shortStory = Math.min(1, 0.5 + pacing.targetDurationMinutes / 8);
  const [minWords, maxWords] = WORDS_PER_PHASE[phase].map((w) => Math.round(w * style.lengthFactor * shortStory));
  const remaining = Math.max(0, pacing.targetDurationMinutes - pacing.elapsedMinutes).toFixed(1);
  const opening = pacing.segmentCount === 0;
  const several = children.length > 1;
  // Siblings take turns answering: the code decides whose turn it is, so nobody gets left out.
  const turnChild = children[state.interactionCount % children.length].name;

  const listeners = children
    .map((c) => `- ${c.name}, age ${c.age}, likes ${c.interests.join(", ") || "anything cozy"}`)
    .join("\n");

  // Which beat to tell now: where the story has got to, but never behind where the pacing needs it.
  const plan = story.plan;
  const beats = plan?.beats ?? [];
  const progress = Math.min(1, pacing.elapsedMinutes / pacing.targetDurationMinutes);
  const neededBeat = Math.min(beats.length - 1, Math.floor(progress * beats.length));
  const nowBeat = Math.min(beats.length - 1, Math.max(story.beatIndex, neededBeat));
  const lastPart = phase === "ending" || phase === "windDown";
  const beatNow = lastPart && beats.length ? beats.length - 1 : nowBeat;
  const planText = plan
    ? `Hero: ${plan.hero}
Hero's worry: ${plan.heroWorry}
Goal: ${plan.goal}
What helps (show it, never say it as a moral): ${plan.comfort}
Beats:
${beats
  .map((b, i) => {
    const mark = i < beatNow ? "done" : i === beatNow ? "NOW: make this happen in this segment" : "later";
    return `${i + 1}. [${mark}] ${b.happens} (hero feels: ${b.heroFeels})`;
  })
  .join("\n")}${
        story.beatIndex < neededBeat && !lastPart ? "\nThe story is running behind: get to the NOW beat in this segment." : ""
      }`
    : "";

  // The whole story so far (recent segments if it's very long), so each segment flows on from it.
  const told = story.narrations.join("\n\n").split(/\s+/);
  const storySoFar = (told.length > 1400 ? "..." + told.slice(-1400).join(" ") : told.join(" ")).trim();
  const memory = {
    title: story.title,
    characters: story.characters,
    changesTheChildAskedFor: story.childChanges,
  };


  const recent = story.narrations.slice(-3);
  const worn = wornOutWords(recent);
  const phrases = repeatedPhrases(recent);
  const asked = pastQuestions(recent);

  return `${several ? "LISTENERS (siblings sharing one story)" : "LISTENER"}
${listeners}
${state.storyRequest ? `Parent's story idea: ${state.storyRequest}\n` : ""}${
    state.parentGoal ? `PRIVATE parent goal (shape the theme; never reveal or mention): ${state.parentGoal}\n` : ""
  }
HERO: do NOT name any character ${names(state).map((n) => `"${n}"`).join(" or ")} (the listeners) unless they ask to be in the story.

AGE STYLE: ${style.label}${several ? `, written for the youngest listener (age ${youngest})` : ""}
${style.guide}
- Past tense for all narration.
${
  planText
    ? `
THE PLAN
${planText}`
    : opening
      ? `
TONIGHT'S STORY: build it around the interests${state.parentGoal ? " and the parent's concern" : ""}. Name the hero one of: ${spark.heroNames.join(", ")}.`
      : ""
}${
  opening
    ? ""
    : `

STORY MEMORY
${JSON.stringify(memory, null, 2)}

THE STORY SO FAR (continue straight on from its last sentence)
${storySoFar}
${worn.length ? `\nWORN-OUT WORDS: you've already used ${worn.join(", ")}. Do NOT use them in this segment.` : ""}${
        phrases.length ? `\nREPEATED PHRASES: ${phrases.join(", ")} already came up more than once. Don't use them again.` : ""
      }${asked.length ? `\nQUESTIONS ALREADY ASKED: ${asked.join(" / ")}. If you ask one, make it a different kind of choice.` : ""}`
}

PACING
Phase: ${PHASE_GUIDANCE[phase]}
Segment ${pacing.segmentCount + 1}. About ${remaining} of ${pacing.targetDurationMinutes} minutes remain.
Length: ${minWords}-${maxWords} words of narration.
Question allowed this turn: ${
    canAsk
      ? `yes — you MAY end with one simple choice, but only if it fits naturally${
          several ? `. It's ${turnChild}'s turn: ask ${turnChild} by name ("${turnChild}, should...?")` : ""
        }`
      : "NO — do not ask the children anything; askForResponse must be false"
  }.

THIS TURN
${describeEvent(event, transcript, state)}${
    acknowledged
      ? `\nYou ALREADY said "${acknowledged}" out loud the moment they finished talking. Don't start with that again; go straight into the rest of your reply (for example, repeat back what they asked for).`
      : ""
  }

Reply with the JSON object only.`;
}
