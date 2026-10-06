// Thin, swappable wrapper around the LLM provider. Everything above this file only sees
// `generateText(system, prompt) -> string`. Uses plain fetch, so no provider SDKs are needed.

import { config, requireKey } from "../config";

export async function generateText(system: string, prompt: string): Promise<string> {
  switch (config.llm.provider) {
    case "gemini":
      return gemini(system, prompt);
    case "groq":
      return openAiCompatible("https://api.groq.com/openai/v1", requireKey("groq"), system, prompt);
    case "openai":
      return openAiCompatible("https://api.openai.com/v1", requireKey("openai"), system, prompt);
    case "mock":
      throw new Error("mock provider is handled by storyEngine");
    default:
      throw new Error(`Unknown LLM_PROVIDER "${config.llm.provider}"`);
  }
}

async function gemini(system: string, prompt: string): Promise<string> {
  const model = config.llm.model;
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    temperature: 0.9,
    maxOutputTokens: 2048,
  };
  // 2.5 Flash "thinks" by default, which adds seconds of latency we don't need for storytelling.
  if (model.startsWith("gemini-2.5-flash")) generationConfig.thinkingConfig = { thinkingBudget: 0 };

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
async function openAiCompatible(baseUrl: string, apiKey: string, system: string, prompt: string) {
  const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.llm.model,
      temperature: 0.9,
      response_format: { type: "json_object" },
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

/** fetch with a timeout and a readable error for non-2xx responses. */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${new URL(url).host} responded ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}
