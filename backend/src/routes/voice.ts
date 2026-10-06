import { Router } from "express";
import { Readable } from "node:stream";
import type { StoryPhase } from "../../../shared/types";
import { disableServerTts, isPermanentTtsFailure, synthesizeStream, type Tone } from "../services/textToSpeech";

export const voiceRouter = Router();

const PHASES: StoryPhase[] = ["interactive", "settling", "windDown", "ending"];

/**
 * GET /api/voice/stream?text=...&phase=...&tone=story|reply -> streamed audio/mpeg
 * A GET URL (not POST) so the browser's <audio> element can play it progressively while it
 * downloads. Identical requests (like the short "Ooh!" acknowledgments) are cached by the browser.
 */
voiceRouter.get("/stream", async (req, res) => {
  const text = String(req.query.text ?? "").trim().slice(0, 4000);
  const phase = PHASES.includes(req.query.phase as StoryPhase) ? (req.query.phase as StoryPhase) : "interactive";
  const tone: Tone = req.query.tone === "reply" ? "reply" : "story";
  if (!text) return res.status(400).json({ error: "No text to speak." });

  // If the child interrupts, the browser drops the request; stop generating audio we won't play.
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const audio = await synthesizeStream(text, phase, tone, abort.signal);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    Readable.fromWeb(audio as import("node:stream/web").ReadableStream).on("error", () => res.end()).pipe(res);
  } catch (err) {
    if (abort.signal.aborted) return;
    console.error("[voice/stream]", (err as Error).message);
    if (isPermanentTtsFailure(err)) disableServerTts("key invalid or out of credits");
    res.status(502).json({ error: "The narrator's voice isn't working right now." });
  }
});
