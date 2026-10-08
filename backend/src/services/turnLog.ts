// Development aid: writes every story turn (what the child said, which model wrote it, the exact
// narration) to backend/logs/turns.jsonl, so problems heard on a real device can be inspected
// afterwards. The folder is gitignored, and nothing is logged in production.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TurnEvent, TurnResponse } from "../../../shared/types";
import { config } from "../config";
import { lastModelUsed } from "./llm";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../logs");
const file = path.join(dir, "turns.jsonl");

export function logTurn(entry: { event: TurnEvent; heard: string; result: TurnResponse }) {
  if (config.isProduction) return;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const { result } = entry;
    const line = {
      time: new Date().toISOString(),
      segment: result.state.pacing.segmentCount,
      phase: result.segment.phase,
      event: entry.event,
      heard: entry.heard,
      model: lastModelUsed,
      narration: result.segment.narration,
      ...(result.state.pacing.segmentCount === 1 ? { plan: result.state.story.plan, children: result.state.children } : {}),
    };
    fs.appendFileSync(file, JSON.stringify(line) + "\n");
  } catch {
    // logging must never break a story
  }
}
