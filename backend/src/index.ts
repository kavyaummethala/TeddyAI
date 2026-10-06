import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "../../shared/types";
import { config } from "./config";
import { speechRouter } from "./routes/speech";
import { storyRouter } from "./routes/story";
import { voiceRouter } from "./routes/voice";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/config", (_req, res) => {
  const body: AppConfig = {
    llm: `${config.llm.provider}:${config.llm.model}`,
    stt: config.stt.provider === "browser" ? "browser" : "server",
    tts: config.tts.provider === "browser" ? "browser" : "server",
  };
  res.json(body);
});
app.use("/api/story", storyRouter);
app.use("/api/speech", speechRouter);
app.use("/api/voice", voiceRouter);

// In production the backend also serves the built frontend, so the app deploys as one service.
if (config.isProduction) {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(config.port, () => {
  console.log(`Teddy backend on http://localhost:${config.port}`);
  console.log(`  story engine: ${config.llm.provider} (${config.llm.model})`);
  console.log(`  speech-to-text: ${config.stt.provider}   text-to-speech: ${config.tts.provider}`);
});
