// Text-to-speech. Streams MP3 audio for a narration segment.
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

/** Teddy's quick spoken reactions ("Ooh, good one!") need a bright, smiling delivery, never flat. */
const REPLY_DELIVERY = {
  lively:
    "Bright, warm, and delighted, with a big smile in your voice, like a loving parent who is genuinely excited by their child's idea. Upbeat and kind. Never flat, never sarcastic.",
  calm: "Soft, warm, and gentle, smiling, like a sleepy loving parent. Kind, never flat.",
};

export type Tone = "story" | "reply";

function deliveryFor(phase: StoryPhase, tone: Tone) {
  if (tone === "reply") return phase === "interactive" || phase === "settling" ? REPLY_DELIVERY.lively : REPLY_DELIVERY.calm;
  return DELIVERY[phase];
}

/**
 * Starts generating narration audio and returns it as a stream of MP3 bytes, so playback can
 * begin after ~1s instead of waiting for the whole segment (which took 5-30s).
 */
export async function synthesizeStream(text: string, phase: StoryPhase, tone: Tone = "story", signal?: AbortSignal) {
  if (config.tts.provider !== "openai") throw new Error("TTS_PROVIDER=browser: speech happens in the browser");

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/audio/speech",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${requireKey("openai")}` },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: config.tts.voice,
        input: text,
        instructions: deliveryFor(phase, tone),
        response_format: "mp3",
      }),
    },
    8_000, // fail fast so the app can switch to the default voice without a long silence
    signal,
  );
  if (!res.body) throw new Error("TTS returned no audio");
  return res.body;
}

/**
 * True if the TTS provider will keep failing until someone fixes the account: invalid or
 * revoked key, or credits used up. (Network blips and rate limits are NOT permanent.)
 */
export function isPermanentTtsFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /responded (401|403)|insufficient_quota|billing|invalid_api_key/i.test(msg);
}

/** Switch the whole app to the browser's built-in voice (new stories will start with it). */
export function disableServerTts(reason: string) {
  if (config.tts.provider === "browser") return;
  config.tts.provider = "browser";
  console.warn(`\n  ⚠️  OpenAI voice disabled (${reason}). Switching to the default browser voice.`);
  console.warn("     Check your OpenAI key / credits, then restart to get the OpenAI voice back.\n");
}
