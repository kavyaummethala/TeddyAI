// Offline, scripted storyteller used when LLM_PROVIDER=mock (or no keys are set).
// It returns the same JSON shape a real model would, so the whole pipeline — parsing, StoryState,
// pacing, Wind Down — runs exactly as it does in production. Useful for demos without Wi-Fi.

import type { StoryPhase, StoryState } from "../../../shared/types";

const COLORS = ["purple", "pink", "green", "orange", "golden", "silver", "blue", "red", "rainbow", "yellow"];

export function mockStoryReply(state: StoryState, transcript: string, phase: StoryPhase, canAsk: boolean): string {
  const said = transcript.toLowerCase();
  const name = "Cosmo";
  const childChanges = [...state.story.childChanges];

  // Remember color changes ("make Cosmo purple").
  const color = COLORS.find((c) => said.includes(c) && /make|turn|be|color|colour/.test(said));
  let childChange: string | null = null;
  if (color) {
    childChange = `${name} is ${color}`;
    childChanges.push(childChange);
  }
  const latestColor = [...childChanges].reverse().find((c) => c.startsWith(`${name} is `))?.slice(name.length + 4);
  const cosmo = latestColor ? `little ${latestColor} ${name}` : `little ${name}`;

  const step = state.pacing.segmentCount;
  let narration: string;
  let askForResponse = false;
  let importantEvent: string | null = null;

  if (color) {
    narration = `Of course! With a twinkle and a sparkle, ${cosmo}'s fur turned a soft, shimmering ${color}. He looked at his paws and purred happily. "I love it," he whispered, and floated on through the quiet stars.`;
  } else if (step === 0) {
    narration = `Once upon a time, high above the sleepy rooftops, there lived a ${cosmo.replace("little ", "small, curious cat named ")}. ${name} had a tiny silver rocket shaped like a fish. Tonight, he wanted to visit somewhere he had never been before: the Moon Garden. His whiskers wiggled a little, because new places felt a bit wobbly inside. But he took one small breath, pressed the big round button, and whoosh, up he went.`;
    importantEvent = `${name} launched toward the Moon Garden.`;
  } else if (phase === "interactive" && canAsk && !state.story.importantEvents.some((e) => e.includes("doors"))) {
    narration = `${cosmo[0].toUpperCase() + cosmo.slice(1)} landed softly on the moon. In front of him stood two mysterious doors. One glowed blue like the ocean, and the other shimmered silver like the moon. Which one should he open?`;
    askForResponse = true;
    importantEvent = `${name} found two doors.`;
  } else if (said.includes("blue") || said.includes("silver")) {
    const door = said.includes("blue") ? "blue" : "silver";
    narration = `${cosmo[0].toUpperCase() + cosmo.slice(1)} padded up to the ${door} door. His heart went thump, thump. He didn't know what was inside. But he pushed, just a little, and the door swung open to a room full of glowing, friendly fireflies. "Hello," they hummed. "We hoped someone brave would come."`;
    importantEvent = `${name} chose the ${door} door and met the fireflies.`;
  } else if (phase === "interactive" || phase === "settling") {
    const beats = [
      `The fireflies led ${cosmo} through the Moon Garden, where silver flowers opened like tiny umbrellas. Everything was new, and with every small step, it felt a little less strange and a little more wonderful. ${name} noticed that the wobbly feeling in his tummy had turned into something warm, like a smile.`,
      `Deep in the garden, ${cosmo} met a shy little moon rabbit hiding behind a crater. "I'm new here too," whispered the rabbit. ${name} remembered how he had felt at the door, so he sat down beside her. "Want to explore together?" he asked. The rabbit smiled, and the two new friends hopped and floated side by side.`,
      `${cosmo[0].toUpperCase() + cosmo.slice(1)} and the moon rabbit found a pond so still it looked like a mirror full of stars. They dipped their paws in, and tiny ripples of light spread out, slow and soft. "Being somewhere new isn't so scary," said ${name}, "when you go one little step at a time."`,
    ];
    narration = beats[step % beats.length];
  } else if (phase === "windDown") {
    const beats = [
      `Slowly, the garden grew quiet. The fireflies dimmed their lights to a soft, sleepy glow. ${cosmo[0].toUpperCase() + cosmo.slice(1)} curled up on a cushion of moon moss and watched the Earth turning gently far below. He breathed in slowly, and breathed out slowly. The stars hummed a quiet lullaby, and his eyes felt heavy and warm.`,
      `The moon rabbit yawned a tiny yawn, and ${name} yawned too. A gentle breeze carried the smell of warm milk and soft blankets. Far away, the Earth glowed blue and green, and somewhere down there was his cozy little bed, waiting just for him. Everything was calm. Everything was safe.`,
    ];
    narration = beats[step % beats.length];
  } else {
    narration = `When it was time, ${cosmo} floated home in his little fish rocket, all the way back to his cozy bed by the window. He tucked his tail around his paws. Tomorrow there would be new places to explore, and now he knew he could be brave, one small step at a time. And with the stars glowing softly outside, ${name} closed his eyes. The end. Goodnight.`;
  }

  return JSON.stringify({
    narration,
    title: "Cosmo and the Moon Garden",
    characters: [`${name} — a small, curious cat${latestColor ? `, now ${latestColor}` : ""}`, "The fireflies — friendly glowing helpers"],
    setting: step === 0 ? "A tiny rocket over sleepy rooftops" : "The Moon Garden",
    summary: `${name} the cat flew to the Moon Garden, felt nervous about a new place, and discovered it became wonderful one small step at a time.`,
    currentScene: narration.split(". ")[0],
    importantEvent,
    childChange,
    askForResponse,
  });
}
