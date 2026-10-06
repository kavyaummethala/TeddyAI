// Types shared by the frontend and backend so the API contract lives in one place.

export type StoryPhase = "interactive" | "settling" | "windDown" | "ending";

/** What the parent fills in on the setup screen. */
export interface ParentSetup {
  childName: string;
  childAge: number;
  interests: string[];
  durationMinutes: number;
  parentGoal?: string;
  storyRequest?: string;
}

/**
 * The story's memory. The backend is stateless: the frontend holds this object
 * and sends it with every turn, and the backend returns an updated copy.
 * A failed turn therefore never corrupts the story — the old state is simply reused.
 */
export interface StoryState {
  child: {
    name: string;
    age: number;
    interests: string[];
  };

  /** Private parent context. Shapes themes; never spoken to the child. */
  parentGoal?: string;
  storyRequest?: string;

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
    /** The last narration, so the model can continue mid-thought after an interruption. */
    lastNarration: string;
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
  | "continue"; // previous segment didn't ask anything; keep going

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
