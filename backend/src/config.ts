// Reads environment variables once and decides which provider powers each step.
// If a *_PROVIDER variable is blank, we pick the best option for the keys that exist,
// so "paste your keys into .env" is the only setup step.

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.resolve(here, "../../.env"));
} catch {
  // No .env file — fall back to real environment variables (e.g. on a host).
}

const env = (name: string) => process.env[name]?.trim() || undefined;

export type LlmProvider = "gemini" | "groq" | "openai" | "mock";
export type SttProvider = "groq" | "openai" | "browser";
export type TtsProvider = "openai" | "browser";

const keys = {
  gemini: env("GEMINI_API_KEY"),
  groq: env("GROQ_API_KEY"),
  openai: env("OPENAI_API_KEY"),
};

function pickLlm(): LlmProvider {
  const chosen = env("LLM_PROVIDER") as LlmProvider | undefined;
  if (chosen) return chosen;
  // OpenAI first: in a side-by-side test it told by far the best stories (Groq's free model produced
  // garbled sentences and hit rate limits). Groq and Gemini are free fallbacks.
  if (keys.openai) return "openai";
  if (keys.groq) return "groq";
  if (keys.gemini) return "gemini";
  return "mock";
}

function pickStt(): SttProvider {
  const chosen = env("STT_PROVIDER") as SttProvider | undefined;
  if (chosen) return chosen;
  if (keys.groq) return "groq";
  if (keys.openai) return "openai";
  return "browser";
}

function pickTts(): TtsProvider {
  const chosen = env("TTS_PROVIDER") as TtsProvider | undefined;
  if (chosen) return chosen;
  return keys.openai ? "openai" : "browser";
}

const llmProvider = pickLlm();
const SMALL_GROQ_MODEL = "openai/gpt-oss-20b";
const SMALL_OPENAI_MODEL = "gpt-4.1-mini";
const defaultModels: Record<LlmProvider, string> = {
  gemini: "gemini-3.5-flash",
  groq: "openai/gpt-oss-120b",
  openai: "gpt-5.4-mini",
  mock: "scripted",
};

export const config = {
  port: Number(env("PORT") ?? 8787),
  isProduction: process.env.NODE_ENV === "production",
  keys,
  llm: {
    provider: llmProvider,
    model: env("LLM_MODEL") ?? defaultModels[llmProvider],
    // If the main provider fails (overloaded, rate-limited, down), try every other provider we have a key for.
    // Groq's free rate limit is per model, so when Groq is the main engine its smaller model is tried
    // first: it's fast and has its own allowance.
    fallbacks: [
      ...(keys.groq && llmProvider === "groq" ? [{ provider: "groq" as const, model: SMALL_GROQ_MODEL }] : []),
      ...(["groq", "gemini", "openai"] as const)
        .filter((p) => p !== llmProvider && llmProvider !== "mock" && keys[p])
        .map((provider) => ({ provider, model: defaultModels[provider] })),
    ],
    /** A smaller, faster model for simple jobs (like rewriting a segment in simpler words). */
    small: keys.openai
      ? { provider: "openai" as const, model: SMALL_OPENAI_MODEL }
      : keys.groq
        ? { provider: "groq" as const, model: SMALL_GROQ_MODEL }
        : undefined,
  },
  stt: { provider: pickStt() },
  // Not readonly: switched to "browser" at runtime if the OpenAI key stops working.
  tts: { provider: pickTts() as TtsProvider, voice: env("TTS_VOICE") ?? "sage" },
};

export function requireKey(name: keyof typeof keys): string {
  const key = keys[name];
  if (!key) throw new Error(`Missing ${name.toUpperCase()}_API_KEY in .env`);
  return key;
}
