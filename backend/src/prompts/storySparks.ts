// Random ingredients that make each night's story different: a story shape (used only when the
// parent didn't share a concern) and fresh hero names, so the model doesn't fall back to its
// favorites ("Nova the cat in a rocket among twinkling stars") every time.

import type { StorySpark } from "../../../shared/types";

const KINDS = [
  "a treasure hunt with clues to follow",
  "a gentle mystery: something small has gone missing and must be found",
  "helping a new friend who is lost find their way home",
  "planning a surprise party for someone",
  "a friendly race or contest where kindness matters more than winning",
  "delivering an important package to someone far away",
  "building something together that keeps going wrong in funny ways",
  "a silly mix-up: two things (or two friends) get swapped",
  "learning a new skill for the very first time",
  "rescuing a tiny creature that needs help",
  "a visit to a grandparent who lives somewhere unusual",
  "finding the source of a strange sound in the night",
  "a lost-and-found: returning something to its owner",
  "the first day somewhere new (a school, a team, a town)",
  "a wish that comes true in an unexpected way",
  "a map that shows somewhere nobody has visited",
];

const HERO_NAMES = [
  "Pip", "Juniper", "Biscuit", "Otto", "Marigold", "Pickle", "Wren", "Bramble", "Tuck", "Hazel",
  "Ziggy", "Clementine", "Barnaby", "Poppy", "Rufus", "Tilly", "Fennel", "Moss", "Peanut", "Ivy",
  "Benny", "Dot", "Gus", "Willow", "Mabel", "Toffee", "Sprout", "Rosie", "Felix", "Olive",
  "Nibbles", "Basil", "Daisy", "Pepper", "Cosette", "Arlo", "Lulu", "Theo", "Fig", "Penny",
  "Sunny", "Kiki", "Maple", "Bodhi", "Ruby", "Jasper", "Tumble", "Winnie", "Hugo", "Pudding",
];

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function pickNames(count: number, avoid: string[]): string[] {
  const lowerAvoid = avoid.map((n) => n.toLowerCase());
  const pool = HERO_NAMES.filter((n) => !lowerAvoid.some((a) => a.includes(n.toLowerCase())));
  const names: string[] = [];
  while (names.length < count && pool.length) names.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  return names;
}

/** @param avoid the listening children's names, plus hero names from recent stories */
export function pickSpark(avoid: string[]): StorySpark {
  return { kind: pick(KINDS), heroNames: pickNames(3, avoid) };
}
