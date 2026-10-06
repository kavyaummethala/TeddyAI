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
  if (keys.gemini) return "gemini";
  if (keys.groq) return "groq";
  if (keys.openai) return "openai";
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
const defaultModels: Record<LlmProvider, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  mock: "scripted",
};

export const config = {
  port: Number(env("PORT") ?? 8787),
  isProduction: process.env.NODE_ENV === "production",
  keys,
  llm: { provider: llmProvider, model: env("LLM_MODEL") ?? defaultModels[llmProvider] },
  stt: { provider: pickStt() },
  tts: { provider: pickTts(), voice: env("TTS_VOICE") ?? "sage" },
};

export function requireKey(name: keyof typeof keys): string {
  const key = keys[name];
  if (!key) throw new Error(`Missing ${name.toUpperCase()}_API_KEY in .env`);
  return key;
}
