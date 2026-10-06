// All HTTP calls to our backend. API keys stay on the server; the browser never sees them.
import type { AppConfig, ParentSetup, StoryPhase, StoryState, TurnEvent, TurnResponse } from "../../../shared/types";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function getConfig(): Promise<AppConfig> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Backend is not reachable");
  return res.json();
}

export async function startStory(setup: ParentSetup): Promise<StoryState> {
  return (await postJson<{ state: StoryState }>("/api/story/start", setup)).state;
}

export function takeTurn(state: StoryState, transcript: string, event: TurnEvent) {
  return postJson<TurnResponse>("/api/story/turn", { state, transcript, event });
}

export async function transcribeAudio(audio: Blob): Promise<string> {
  const res = await fetch("/api/speech/transcribe", {
    method: "POST",
    headers: { "Content-Type": audio.type || "audio/webm" },
    body: audio,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Transcription failed");
  return data.transcript ?? "";
}

export async function synthesizeSpeech(text: string, phase: StoryPhase): Promise<Blob> {
  const res = await fetch("/api/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, phase }),
  });
  if (!res.ok) throw new Error("Narration audio failed");
  return res.blob();
}
