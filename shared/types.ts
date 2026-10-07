// Types shared by the frontend and backend so the API contract lives in one place.

export type StoryPhase = "interactive" | "settling" | "windDown" | "ending";

export interface ChildInfo {
  name: string;
  age: number;
  interests: string[];
}

/** What the parent fills in on the setup screen. One story can be for several children at once. */
export interface ParentSetup {
  children: ChildInfo[];
  /** 1 to 20 minutes. */
  durationMinutes: number;
  parentGoal?: string;
  storyRequest?: string;
  /** Recent stories these children heard ("Nova and the Moon Key"), so tonight's is different. */
  recentStories?: string[];
}

/**
 * A random starting point picked when the story begins. Without it, the model drifts to the
 * same predictable story every night (same hero names, same rocket, same twinkling stars).
 */
export interface StorySpark {
  kind: string;
  surprise: string;
  heroNames: string[];
}

/**
 * The story's memory. The backend is stateless: the frontend holds this object
 * and sends it with every turn, and the backend returns an updated copy.
 * A failed turn therefore never corrupts the story — the old state is simply reused.
 */
export interface StoryState {
  /** Everyone listening. Usually one child; siblings can share a story. */
  children: ChildInfo[];

  /** Private parent context. Shapes themes; never spoken to the child. */
  parentGoal?: string;
  storyRequest?: string;
  recentStories?: string[];
  spark: StorySpark;

  story: {
    title?: string;
    /** Each entry is a name plus current traits, e.g. "Cosmo — a small, curious cat, now purple". */
    characters: string[];
    setting?: string;
    summary: string;
    currentScene: string;
    importantEvents: string[];
    /** Changes the child asked for ("make Cosmo purple"); must persist for the rest of the story. */
    childChanges: string[];
    /** The plot written at the start: 4-5 steps toward a goal. Each segment moves one step on. */
    plan: string[];
    /** The last few narrations, to continue mid-thought after an interruption and to avoid repeating phrases. */
    recentNarrations: string[];
  };

  pacing: {
    targetDurationMinutes: number;
    /** Estimated from narrated words + interactions (see backend/src/models/storyState.ts). */
    elapsedMinutes: number;
    phase: StoryPhase;
    segmentCount: number;
    wordsNarrated: number;
    segmentsSinceQuestion: number;
  };

  interactionCount: number;
  finished: boolean;
}

/** Why the frontend is asking for the next segment. */
export type TurnEvent =
  | "child_spoke" // child answered or made a request
  | "interrupted" // child tapped the mic while narration was playing
  | "no_response" // story asked a question but the child stayed quiet (maybe drifting off)
  | "continue" // previous segment didn't ask anything; keep going
  | "wrap_up"; // the grown-up pressed "Finish story": end peacefully now

export interface StorySegment {
  narration: string;
  askForResponse: boolean;
  phase: StoryPhase;
  finished: boolean;
}

export interface TurnRequest {
  state: StoryState;
  transcript: string;
  event: TurnEvent;
  /** A quick reply ("Ooh!") the app already spoke the instant the child finished talking. */
  acknowledged?: string;
}

export interface TurnResponse {
  state: StoryState;
  segment: StorySegment;
}

export interface AppConfig {
  llm: string;
  /** "server" = record audio and transcribe on the backend; "browser" = Web Speech API. */
  stt: "server" | "browser";
  /** "server" = backend returns audio; "browser" = speechSynthesis. */
  tts: "server" | "browser";
}
