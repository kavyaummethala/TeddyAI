// Text-to-speech. Returns MP3 bytes for a narration segment.
// The voice gets calmer and slower as the story moves through Wind Down Mode.

import type { StoryPhase } from "../../../shared/types";
import { config, requireKey } from "../config";
import { fetchWithTimeout } from "./llm";

const DELIVERY: Record<StoryPhase, string> = {
  interactive: "Warm, gentle, and lightly playful, like a loving parent reading a bedtime story. Unhurried.",
  settling: "Calm and soothing, a little slower and softer, like a parent reading at bedtime.",
  windDown: "Very slow, soft, and sleepy, almost a whisper. Long, relaxed pauses between sentences.",
  ending: "The softest, slowest, most soothing voice, as if the child is nearly asleep. Gentle pauses.",
};

export async function synthesize(text: string, phase: StoryPhase): Promise<Buffer> {
  if (config.tts.provider !== "openai") throw new Error("TTS_PROVIDER=browser: speech happens in the browser");

  const res = await fetchWithTimeout("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${requireKey("openai")}` },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: config.tts.voice,
      input: text,
      instructions: DELIVERY[phase],
      response_format: "mp3",
    }),
  });
  return Buffer.from(await res.arrayBuffer());
}
