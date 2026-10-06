// The voice loop as a small state machine:
//
//   READY --tap--> LISTENING --speech--> THINKING --segment--> SPEAKING --+
//     ^                ^                                                   |
//     |                +------- story asked a question --------------------+
//     |                         story didn't ask: THINKING (auto-continue) |
//   (errors)                    story finished: FINISHED <-----------------+
//
// Tapping the mic while SPEAKING interrupts the narration and starts LISTENING.
// Every async flow captures a "run id"; if the user has since moved on (interrupted,
// retried, left), the stale flow sees a newer id and quietly stops.

import { useEffect, useRef, useState } from "react";
import type { AppConfig, StorySegment, StoryState, TurnEvent } from "../../../shared/types";
import { takeTurn } from "../services/api";
import { listen, MicError, type Listening } from "../services/listen";
import { narrate, unlockAudio, type Narration } from "../services/narrator";

export type SessionStatus = "ready" | "listening" | "thinking" | "speaking" | "finished";
export type SessionError = { kind: "mic" | "stt" | "llm" | "tts"; message: string };

const MESSAGES = {
  mic: "I couldn't hear that. Want to try again? (Check that the microphone is allowed.)",
  stt: "I couldn't hear that. Want to try again?",
  llm: "Teddy lost the thread for a moment. Tap retry and the story will pick up right where it was.",
  tts: "Teddy's voice isn't working right now. You can read this part below, then retry or keep going.",
};

export function useStorySession(initialState: StoryState, config: AppConfig) {
  const [state, setState] = useState(initialState);
  const [status, setStatus] = useState<SessionStatus>("ready");
  const [narration, setNarration] = useState("");
  const [lastHeard, setLastHeard] = useState("");
  const [error, setError] = useState<SessionError | null>(null);
  const [micLevel, setMicLevel] = useState(0);

  const stateRef = useRef(initialState);
  const runId = useRef(0);
  const listening = useRef<Listening | null>(null);
  const speaking = useRef<Narration | null>(null);
  const lastSegment = useRef<StorySegment | null>(null);
  const pendingTurn = useRef<{ transcript: string; event: TurnEvent } | null>(null);
  const audioUnlocked = useRef(false);

  // Stop everything if the screen unmounts mid-story.
  useEffect(
    () => () => {
      runId.current++;
      speaking.current?.stop();
      listening.current?.cancel();
    },
    [],
  );

  function fail(kind: SessionError["kind"]) {
    setError({ kind, message: MESSAGES[kind] });
    setStatus("ready");
  }

  /** After a segment has been spoken: listen, auto-continue, or finish. */
  function afterSegment(segment: StorySegment) {
    if (segment.finished) setStatus("finished");
    else if (segment.askForResponse) startListening("child_spoke", true);
    else runTurn("", "continue");
  }

  async function speak(segment: StorySegment) {
    const myRun = ++runId.current;
    setStatus("speaking");
    setError(null);
    const n = narrate(segment.narration, segment.phase, config.tts);
    speaking.current = n;
    try {
      const outcome = await n.done;
      if (myRun !== runId.current || outcome === "stopped") return;
      afterSegment(segment);
    } catch {
      if (myRun === runId.current) fail("tts");
    }
  }

  async function runTurn(transcript: string, event: TurnEvent) {
    const myRun = ++runId.current;
    pendingTurn.current = { transcript, event };
    setStatus("thinking");
    setError(null);
    try {
      // StoryState only changes after a successful turn, so a failure here loses nothing.
      const res = await takeTurn(stateRef.current, transcript, event);
      if (myRun !== runId.current) return;
      stateRef.current = res.state;
      setState(res.state);
      pendingTurn.current = null;
      lastSegment.current = res.segment;
      setNarration(res.segment.narration);
      if (!transcript) setLastHeard(""); // only show the child's words next to the reply to them
      speak(res.segment);
    } catch {
      if (myRun === runId.current) fail("llm");
    }
  }

  /**
   * @param afterQuestion the story just asked something. If the child stays quiet we
   *   don't nag — the story gently continues on its own (they may be falling asleep).
   */
  async function startListening(event: TurnEvent, afterQuestion = false) {
    const myRun = ++runId.current;
    setStatus("listening");
    setError(null);
    const l = listen({ mode: config.stt, onLevel: setMicLevel, noSpeechTimeoutMs: afterQuestion ? 8000 : 10000 });
    listening.current = l;
    try {
      const text = (await l.result).trim();
      if (myRun !== runId.current) return;
      if (text) {
        setLastHeard(text);
        runTurn(text, event);
      } else if (afterQuestion) {
        runTurn("", "no_response");
      } else if (stateRef.current.pacing.segmentCount === 0) {
        runTurn("", "child_spoke"); // nothing said at the start: begin with their interests
      } else {
        fail("stt");
      }
    } catch (err) {
      if (myRun === runId.current) fail(err instanceof MicError ? "mic" : "stt");
    } finally {
      setMicLevel(0);
      if (listening.current === l) listening.current = null;
    }
  }

  /** The one big button. What it does depends on the current state. */
  function pressMic() {
    if (!audioUnlocked.current) {
      unlockAudio();
      audioUnlocked.current = true;
    }
    switch (status) {
      case "listening":
        listening.current?.stop(); // done talking — send it now
        break;
      case "speaking":
        runId.current++;
        speaking.current?.stop();
        startListening("interrupted");
        break;
      case "ready":
        startListening("child_spoke");
        break;
      // "thinking" and "finished": ignore taps
    }
  }

  /** Retry whatever failed, without losing the story. */
  function retry() {
    if (!error) return;
    if (error.kind === "llm" && pendingTurn.current) runTurn(pendingTurn.current.transcript, pendingTurn.current.event);
    else if (error.kind === "tts" && lastSegment.current) speak(lastSegment.current);
    else startListening("child_spoke");
  }

  /** Skip past a problem and keep the story going (e.g. no audio, or the child changed their mind). */
  function keepGoing() {
    const segment = lastSegment.current;
    if (!segment) return startListening("child_spoke");
    if (error?.kind === "tts") afterSegment({ ...segment, askForResponse: false });
    else if (error?.kind === "llm" && pendingTurn.current) retry();
    else runTurn("", "continue");
  }

  return { state, status, narration, lastHeard, error, micLevel, pressMic, retry, keepGoing };
}
