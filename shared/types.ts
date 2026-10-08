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
  /**
   * Hero names from these children's recent stories. Used only by code to pick a fresh hero name;
   * never shown to the model (listing old stories made it borrow details from them).
   */
  recentHeroes?: string[];
}

/**
 * A random starting point picked when the story begins. Without it, the model drifts to the
 * same predictable story every night (same hero names, same rocket, same twinkling stars).
 */
/**
 * The story outline, written by a separate planning step before the first segment. When the parent
 * shared a worry, the hero lives through a story version of it, and each beat says what HAPPENS and
 * what the hero FEELS, so the story has an emotional arc instead of drifting from scene to scene.
 */
export interface StoryPlan {
  hero: string;
  /** The hero's own version of what's on the child's mind, e.g. "first day at Moon School; worried nobody will play with her". */
  heroWorry: string;
  /** What the hero wants, concretely. */
  goal: string;
  /** What the hero discovers that helps, shown through events (never said as a moral). */
  comfort: string;
  beats: { happens: string; heroFeels: string }[];
}

export interface StorySpark {
  /** A story shape, used only when the parent didn't share a concern (which then shapes the story). */
  kind: string;
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
    /** The outline from the planning step (absent only if planning failed). */
    plan?: StoryPlan;
    /** Which beat of the plan the story has reached. */
    beatIndex: number;
    /** Every segment told so far, in order. The narrator reads the whole story so it flows as one tale. */
    narrations: string[];
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
