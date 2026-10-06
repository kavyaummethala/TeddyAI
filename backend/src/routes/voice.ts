import { Router } from "express";
import type { StoryPhase } from "../../../shared/types";
import { synthesize } from "../services/textToSpeech";

export const voiceRouter = Router();

/** POST /api/voice/speak { text, phase } -> audio/mpeg */
voiceRouter.post("/speak", async (req, res) => {
  const text = String(req.body?.text ?? "").trim().slice(0, 4000);
  const phase = (req.body?.phase ?? "interactive") as StoryPhase;
  if (!text) return res.status(400).json({ error: "No text to speak." });
  try {
    const audio = await synthesize(text, phase);
    res.type("audio/mpeg").send(audio);
  } catch (err) {
    console.error("[voice/speak]", err);
    res.status(502).json({ error: "The narrator's voice isn't working right now." });
  }
});
