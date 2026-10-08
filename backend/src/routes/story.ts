import { Router } from "express";
import type { ChildInfo, ParentSetup, TurnEvent, TurnRequest, TurnResponse } from "../../../shared/types";
import { createInitialState } from "../models/storyState";
import { nextSegment } from "../services/storyEngine";
import { logTurn } from "../services/turnLog";

export const storyRouter = Router();

const EVENTS: TurnEvent[] = ["child_spoke", "interrupted", "no_response", "continue", "wrap_up"];

const cleanList = (v: unknown, max: number, maxLen: number) =>
  (Array.isArray(v) ? v : [])
    .map((s) => String(s).trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, max);

/** POST /api/story/start — validate the parent's setup and return a fresh StoryState. */
storyRouter.post("/start", (req, res) => {
  const body = req.body as Partial<ParentSetup>;
  const durationMinutes = Number(body.durationMinutes);
  const rawChildren = Array.isArray(body.children) ? body.children.slice(0, 4) : [];

  const children: ChildInfo[] = [];
  for (const c of rawChildren) {
    const name = String(c?.name ?? "").trim().slice(0, 40);
    const age = Number(c?.age);
    if (!name) return res.status(400).json({ error: "Please enter each child's name." });
    if (!Number.isFinite(age) || age < 2 || age > 12)
      return res.status(400).json({ error: `${name}'s age should be between 2 and 12.` });
    children.push({ name, age, interests: cleanList(c?.interests, 8, 40) });
  }
  if (children.length === 0) return res.status(400).json({ error: "Choose at least one child." });
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 20)
    return res.status(400).json({ error: "Story length must be 1 to 20 minutes." });

  const setup: ParentSetup = {
    children,
    durationMinutes,
    parentGoal: String(body.parentGoal ?? "").trim().slice(0, 600),
    storyRequest: String(body.storyRequest ?? "").trim().slice(0, 300),
    recentHeroes: cleanList(body.recentHeroes, 10, 30),
  };
  res.json({ state: createInitialState(setup) });
});

/** POST /api/story/turn — state + child's words in, next segment + updated state out. */
storyRouter.post("/turn", async (req, res) => {
  const { state, transcript, event, acknowledged } = req.body as Partial<TurnRequest>;
  if (!state?.pacing || !state.story) return res.status(400).json({ error: "Missing story state." });
  if (!event || !EVENTS.includes(event)) return res.status(400).json({ error: "Invalid event." });

  try {
    const result: TurnResponse = await nextSegment(
      state,
      String(transcript ?? "").slice(0, 500),
      event,
      acknowledged ? String(acknowledged).slice(0, 200) : undefined,
    );
    logTurn({ event, heard: String(transcript ?? ""), result });
    res.json(result);
  } catch (err) {
    console.error("[story/turn]", err);
    // The client keeps its previous state, so a retry is always safe.
    res.status(502).json({ error: "The storyteller couldn't think of the next part." });
  }
});
