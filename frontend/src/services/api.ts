// All HTTP calls to our backend. API keys stay on the server; the browser never sees them.
import type { AppConfig, ParentSetup, StoryState, TurnEvent, TurnResponse } from "../../../shared/types";

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

/** @param acknowledged the quick reply ("Ooh!") already spoken aloud, so the story doesn't repeat it */
export function takeTurn(state: StoryState, transcript: string, event: TurnEvent, acknowledged?: string) {
  return postJson<TurnResponse>("/api/story/turn", { state, transcript, event, acknowledged });
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
