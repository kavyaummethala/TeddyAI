// Thin, swappable wrapper around the LLM provider. Everything above this file only sees
// `generateText(system, prompt) -> string`. Uses plain fetch, so no provider SDKs are needed.

import { config, requireKey } from "../config";

type Target = { provider: string; model: string };

/** Tries the main provider, then each fallback, so one overloaded provider doesn't stop the story. */
export async function generateText(system: string, prompt: string): Promise<string> {
  const targets: Target[] = [config.llm, ...config.llm.fallbacks];
  let lastError: unknown;
  for (const target of targets) {
    try {
      return await callProvider(target, system, prompt);
    } catch (err) {
      lastError = err;
      console.warn(`[llm] ${target.provider} (${target.model}) failed: ${(err as Error).message.slice(0, 160)}`);
    }
  }
  throw lastError;
}

function callProvider({ provider, model }: Target, system: string, prompt: string): Promise<string> {
  switch (provider) {
    case "gemini":
      return gemini(model, system, prompt);
    case "groq":
      return openAiCompatible("https://api.groq.com/openai/v1", requireKey("groq"), model, system, prompt);
    case "openai":
      return openAiCompatible("https://api.openai.com/v1", requireKey("openai"), model, system, prompt);
    default:
      throw new Error(`Unknown LLM_PROVIDER "${provider}"`);
  }
}

async function gemini(model: string, system: string, prompt: string): Promise<string> {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    temperature: 0.9,
    maxOutputTokens: 2048,
  };
  // Flash models "think" by default, which adds seconds of latency we don't need for storytelling.
  if (model.startsWith("gemini-2.5-flash")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  else if (model.startsWith("gemini-3")) generationConfig.thinkingConfig = { thinkingLevel: "low" };

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": requireKey("gemini") },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      }),
    },
  );
  const data = await res.json();
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  if (!text) throw new Error(`Gemini returned no text (finishReason: ${data?.candidates?.[0]?.finishReason})`);
  return text;
}

/** Works for OpenAI and any OpenAI-compatible API (Groq, etc.). */
async function openAiCompatible(baseUrl: string, apiKey: string, model: string, system: string, prompt: string) {
  const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      response_format: { type: "json_object" },
      // gpt-oss models reason before answering; keep it short for low latency.
      ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM returned no text");
  return text;
}

/**
 * fetch with a timeout on the *response headers* (the body may then stream for as long as it
 * needs) and a readable error for non-2xx responses. `signal` lets callers abort early.
 */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30_000, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`${new URL(url).host} timed out`)), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort(signal.reason));
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${new URL(url).host} responded ${res.status}: ${body.slice(0, 300)}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}
