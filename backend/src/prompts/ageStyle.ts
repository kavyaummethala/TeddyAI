// How the story should sound for each age group. A 3-year-old and a 9-year-old need very different
// stories: different words, sentence lengths, plot complexity, and segment lengths.

export interface AgeStyle {
  label: string;
  /** Multiplies the per-phase word targets: younger children get shorter segments. */
  lengthFactor: number;
  guide: string;
}

export function ageStyle(age: number): AgeStyle {
  if (age <= 4) {
    return {
      label: "toddler / preschool (2-4)",
      lengthFactor: 0.6,
      guide: `- Very short sentences, about 4-8 words each.
- Only everyday words a 3-year-old already knows: big, little, happy, sleepy, run, jump, hug, moon, star, cat. No fancy words at all.
- Repetition is good: invent a little repeated line that comes back in later segments.
- Fun sound words: whoosh, boing, splash, purr, yawn.
- One main character, one simple goal. Things happen one at a time.
- Describe things only by color, size, or sound ("a big red rocket").`,
    };
  }
  if (age <= 6) {
    return {
      label: "young child (5-6)",
      lengthFactor: 0.8,
      guide: `- Short, simple sentences, mostly under 12 words.
- Common words a kindergartner uses. At most one "new" word per segment, and make its meaning obvious right away.
- Mostly action and dialogue: characters DO things and SAY things. Only a little description.
- Silly, funny moments keep it fun (invent your own; something gently surprising or a little goofy).
- A clear goal, a friendly sidekick, and easy-to-follow cause and effect.`,
    };
  }
  if (age <= 8) {
    return {
      label: "early reader (7-8)",
      lengthFactor: 1,
      guide: `- Clear sentences of varied length. A few interesting words are fine if the meaning is clear from context.
- Lively dialogue, humor, and a small puzzle or mystery to solve.
- Two or three characters with distinct personalities.
- Keep description short and concrete; the plot should keep moving.`,
    };
  }
  return {
    label: "older child (9-12)",
    lengthFactor: 1.15,
    guide: `- Richer vocabulary and longer sentences are fine, but keep it vivid and concrete, not flowery.
- Witty dialogue, a more interesting plot with a twist or clever solution, characters with real feelings.
- Never talk down to them or sound babyish.`,
  };
}
