// A simple reading-level check for one story segment, so "simple words for a 4-year-old" is enforced
// in code instead of just hoped for. It measures two things young-reader formulas also rely on:
// average sentence length, and the share of "hard" words (long words with 3+ syllables).

/** Long words that young children know well anyway, so they don't count as hard. */
const KID_WORDS = new Set(
  `butterfly butterflies elephant elephants dinosaur dinosaurs banana bananas family everyone everybody together tomorrow
  yesterday animal animals umbrella kangaroo crocodile octopus broccoli spaghetti computer adventure adventures
  grandmother grandfather grandmama grandpapa ladybug ladybugs strawberry strawberries blueberry blueberries
  caterpillar helicopter dragonfly favorite another underneath everything something anything nobody somebody
  wonderful remember remembered tricycle bicycle astronaut astronauts rocket pajamas pajama gorilla library
  potato potatoes tomato tomatoes`.split(/\s+/),
);

function syllables(word: string): number {
  // Silent endings: "whispered" is 2 syllables, "smile" is 1 ("-ted"/"-ded" do add one: "waited").
  const w = word.toLowerCase().replace(/(?<![td])ed$/, "").replace(/e$/, "");
  return Math.max(1, (w.match(/[aeiouy]+/g) ?? []).length);
}

export interface ReadingLevel {
  avgSentenceWords: number;
  hardWordPercent: number;
  hardWords: string[];
}

/** @param ignore names and interest words that shouldn't count as hard ("Clementine", "dinosaurs") */
export function measureReadingLevel(text: string, ignore: string[] = []): ReadingLevel {
  const sentences = text.split(/[.!?]+["'”’)]*/).map((s) => s.trim()).filter((s) => /[a-z]/i.test(s));
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  const ignored = new Set(ignore.flatMap((n) => n.toLowerCase().split(/[\s,—-]+/)));
  // Proper nouns (names) are capitalized mid-sentence; skip them.
  const properNouns = new Set((text.match(/(?<=[a-z,;]\s)[A-Z][a-z]+/g) ?? []).map((w) => w.toLowerCase()));

  const hardWords = words.filter((raw) => {
    const w = raw.toLowerCase().replace(/['’]s$/, "");
    if (ignored.has(w) || properNouns.has(w) || KID_WORDS.has(w) || w.includes("-")) return false;
    return w.length >= 7 && syllables(w) >= 3;
  });

  return {
    avgSentenceWords: sentences.length ? words.length / sentences.length : words.length,
    hardWordPercent: words.length ? (hardWords.length / words.length) * 100 : 0,
    hardWords: [...new Set(hardWords.map((w) => w.toLowerCase()))],
  };
}

export function tooHard(level: ReadingLevel, limits: { maxAvgSentenceWords: number; maxHardWordPercent: number }) {
  // Only clear problems get a rewrite: a rewrite risks making good text choppy, so a borderline
  // passage (or one long word) is left alone.
  const tooManyHardWords = level.hardWords.length >= 3 && level.hardWordPercent > limits.maxHardWordPercent;
  return level.avgSentenceWords > limits.maxAvgSentenceWords || tooManyHardWords;
}
