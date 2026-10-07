// Random ingredients that make each night's story different. The model combines one story kind
// and one surprise with the child's interests, and names the hero from a fresh list, instead of
// falling back to its favorites ("Nova the cat in a rocket among twinkling stars") every time.

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

const SURPRISES = [
  "a grumpy cloud who turns out to be shy",
  "a teapot that can talk but only in rhymes",
  "a map whose drawings move when no one is looking",
  "a pair of boots that hop on their own",
  "a very polite snail who is always in a hurry",
  "a lighthouse that has forgotten how to glow",
  "a sock that keeps escaping",
  "a backwards day where everyone walks backwards",
  "a tiny dragon with the hiccups",
  "an umbrella that rains upward",
  "a giant who is afraid of the dark",
  "a bridge made of sleeping turtles",
  "a library where the books whisper hints",
  "a moose who wants to learn to dance",
  "a key that opens only things that are smiling",
  "a puddle that is actually a doorway",
  "a garden where vegetables tell jokes",
  "a bicycle with wings that only work when you sing",
  "a snowman who wants to visit the beach",
  "a robot who collects interesting sounds",
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

/** @param avoid the listening children's names, plus names from recent stories */
export function pickSpark(avoid: string[]): StorySpark {
  return { kind: pick(KINDS), surprise: pick(SURPRISES), heroNames: pickNames(3, avoid) };
}
