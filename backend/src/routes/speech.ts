import express, { Router } from "express";
import { transcribe } from "../services/speechToText";

export const speechRouter = Router();

/** POST /api/speech/transcribe — raw audio body (audio/webm, audio/mp4, ...) -> { transcript } */
speechRouter.post(
  "/transcribe",
  express.raw({ type: ["audio/*", "application/octet-stream"], limit: "15mb" }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 1000)
      return res.json({ transcript: "" }); // too short to contain speech
    try {
      const mime = (req.headers["content-type"] ?? "audio/webm").split(";")[0];
      // Audio is only held in memory for this request and never stored.
      res.json({ transcript: await transcribe(req.body, mime) });
    } catch (err) {
      console.error("[speech/transcribe]", err);
      res.status(502).json({ error: "I couldn't hear that." });
    }
  },
);
