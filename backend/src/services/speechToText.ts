// Speech-to-text. Takes the recorded audio bytes and returns the child's words.
// Groq and OpenAI both expose the same Whisper-style /audio/transcriptions endpoint.

import { config, requireKey } from "../config";
import { fetchWithTimeout } from "./llm";

const PROVIDERS = {
  groq: { url: "https://api.groq.com/openai/v1/audio/transcriptions", model: "whisper-large-v3-turbo" },
  openai: { url: "https://api.openai.com/v1/audio/transcriptions", model: "gpt-4o-mini-transcribe" },
} as const;

// Whisper sometimes "hears" these phrases in near-silence. Treat them as no speech.
const SILENCE_HALLUCINATIONS = /^(thank you|thanks for watching|you|bye|\.|okay)[.!]*$/i;

export async function transcribe(audio: Buffer, mimeType: string): Promise<string> {
  const provider = config.stt.provider;
  if (provider === "browser") throw new Error("STT_PROVIDER=browser: transcription happens in the browser");
  const { url, model } = PROVIDERS[provider];

  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `speech.${ext}`);
  form.append("model", model);
  form.append("language", "en");
  // A hint improves accuracy on children's speech and story vocabulary.
  form.append("prompt", "A young child talking to a bedtime storyteller about their story.");

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireKey(provider)}` },
    body: form,
  });
  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  return SILENCE_HALLUCINATIONS.test(text) ? "" : text;
}
