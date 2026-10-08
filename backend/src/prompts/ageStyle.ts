// How the story should sound for each age group. A 3-year-old and a 9-year-old need very different
// stories: different words, sentence lengths, plot complexity, and segment lengths.
//
// The guide is what the model is told; `limits` is what the code then CHECKS (services/readability.ts).
// If a segment comes back too hard for the age, it gets rewritten in simpler words.

export interface AgeStyle {
  label: string;
  /** Multiplies the per-phase word targets: younger children get shorter segments. */
  lengthFactor: number;
  guide: string;
  /** Reading-level limits checked in code; null = no check (older children). */
  limits: { maxAvgSentenceWords: number; maxHardWordPercent: number } | null;
}

export function ageStyle(age: number): AgeStyle {
  if (age <= 4) {
    return {
      label: "toddler / preschool (2-4)",
      lengthFactor: 0.6,
      limits: { maxAvgSentenceWords: 10, maxHardWordPercent: 5 },
      guide: `- Short, complete, natural sentences (usually 5 to 9 words), like a toddler picture book. Never broken phrases.
- Everyday words a 3-year-old knows. "Very big" instead of "enormous", "shiny" instead of "glittering".
- Gentle rhythm, a little repetition, and the odd sound word (whoosh, splash, yawn).
- Example of the style (for style only, don't reuse the content):
  "Little Bear looked at the dark window. 'I don't like the dark,' he said. Mama Bear sat down on his bed. 'Let's listen together,' she said. Outside, an owl went hoo, hoo. Little Bear held his blanket tight."`,
    };
  }
  if (age <= 6) {
    return {
      label: "young child (5-6)",
      lengthFactor: 0.8,
      limits: { maxAvgSentenceWords: 13, maxHardWordPercent: 8 },
      guide: `- Simple, complete sentences, mostly 6 to 12 words. Everyday words a kindergartner uses.
- Lots of dialogue and action; just a little description. A gently funny moment now and then.
- Example of the style (for style only, don't reuse the content):
  "On the first day of school, Pip stood by the door and didn't move. The other kittens were already playing tag. 'What if nobody wants to play with me?' Pip whispered. Then a small gray kitten ran over. 'We need one more for tag,' she said. 'Want to play?'"`,
    };
  }
  if (age <= 8) {
    return {
      label: "early reader (7-8)",
      lengthFactor: 1,
      limits: { maxAvgSentenceWords: 17, maxHardWordPercent: 12 },
      guide: `- Clear sentences of varied length. A few interesting words are fine if the meaning is clear from context.
- Lively dialogue, a little humor, characters with distinct personalities. Keep the plot moving.
- Example of the style (for style only, don't reuse the content):
  "Otto had practiced his speech for the class show all week, but now his knees felt like jelly. 'What if I forget everything?' he muttered. His friend Rosa grinned. 'Then make something up. You're good at that.' Otto laughed, and somehow his knees felt a little less wobbly."`,
    };
  }
  return {
    label: "older child (9-12)",
    lengthFactor: 1.15,
    limits: null,
    guide: `- Richer vocabulary and longer sentences are fine, but keep it vivid and concrete, not flowery.
- Witty dialogue, a plot with a clever turn, characters with real feelings. Never talk down to them.`,
  };
}
