import { Router } from "express";
import type { ParentSetup, TurnEvent, TurnRequest, TurnResponse } from "../../../shared/types";
import { createInitialState } from "../models/storyState";
import { nextSegment } from "../services/storyEngine";

export const storyRouter = Router();

const EVENTS: TurnEvent[] = ["child_spoke", "interrupted", "no_response", "continue", "wrap_up"];

/** POST /api/story/start — validate the parent's setup and return a fresh StoryState. */
storyRouter.post("/start", (req, res) => {
  const body = req.body as Partial<ParentSetup>;
  const childName = String(body.childName ?? "").trim().slice(0, 40);
  const childAge = Number(body.childAge);
  const durationMinutes = Number(body.durationMinutes);

  if (!childName) return res.status(400).json({ error: "Please enter the child's name." });
  if (!Number.isFinite(childAge) || childAge < 2 || childAge > 12)
    return res.status(400).json({ error: "Age should be between 2 and 12." });
  if (![5, 8, 10].includes(durationMinutes))
    return res.status(400).json({ error: "Story length must be 5, 8, or 10 minutes." });

  const setup: ParentSetup = {
    childName,
    childAge,
    durationMinutes,
    interests: (Array.isArray(body.interests) ? body.interests : [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 8),
    parentGoal: String(body.parentGoal ?? "").trim().slice(0, 600),
    storyRequest: String(body.storyRequest ?? "").trim().slice(0, 300),
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
      acknowledged ? String(acknowledged).slice(0, 40) : undefined,
    );
    res.json(result);
  } catch (err) {
    console.error("[story/turn]", err);
    // The client keeps its previous state, so a retry is always safe.
    res.status(502).json({ error: "The storyteller couldn't think of the next part." });
  }
});
