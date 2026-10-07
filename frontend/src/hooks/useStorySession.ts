// The voice loop as a small state machine:
//
//   READY --tap--> LISTENING --speech--> THINKING --segment--> SPEAKING --+
//     ^                ^                                                   |
//     |                +------- story asked a question --------------------+
//     |                         story didn't ask: THINKING (auto-continue) |
//   (errors)                    story finished: FINISHED <-----------------+
//
// Tapping Teddy, or saying "Teddy!", while SPEAKING interrupts the narration and starts LISTENING.
// Speed tricks (a child's attention span is short):
//  - narration audio streams, so Teddy starts talking ~1s after the text is ready;
//  - the moment the child's words are understood, Teddy says a quick "Ooh!" while the
//    next part is being written;
//  - while a segment that doesn't ask anything is playing, the next one is fetched in the
//    background ("prefetch"), so there's no pause between them.
//
// Every async flow captures a "run id"; if the user has since moved on (interrupted,
// retried, left), the stale flow sees a newer id and quietly stops.

import { useEffect, useRef, useState } from "react";
import type { AppConfig, StorySegment, StoryState, TurnEvent, TurnResponse } from "../../../shared/types";
import { takeTurn } from "../services/api";
import { listen, MicError, type Listening } from "../services/listen";
import { chime, warmUpChimes } from "../services/chime";
import {
  narrate,
  preloadQuickReplies,
  quickReply,
  sayLine,
  unlockAudio,
  wakeReply,
  type Narration,
} from "../services/narrator";
import { firstReply, greeting, LINES } from "../services/teddyLines";
import { containsWakeWord, isWakeWordSupported, listenForWakeWord } from "../services/wakeWord";

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
  // Teddy starts by greeting the child out loud, so the first state is "speaking".
  const [status, setStatus] = useState<SessionStatus>("speaking");
  const [narration, setNarration] = useState("");
  const [lastHeard, setLastHeard] = useState("");
  const [error, setError] = useState<SessionError | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [notice, setNotice] = useState("");

  const stateRef = useRef(initialState);
  const runId = useRef(0);
  const listening = useRef<Listening | null>(null);
  const speaking = useRef<Narration | null>(null);
  const lastSegment = useRef<StorySegment | null>(null);
  const pendingTurn = useRef<{ transcript: string; event: TurnEvent } | null>(null);
  const audioUnlocked = useRef(false);
  /** Starts as the server's voice; drops to the browser's built-in voice if that stops working. */
  const ttsMode = useRef(config.tts);
  /** Stops the "Teddy!" wake-word listener (a no-op when it isn't running). */
  const stopWakeWord = useRef<() => void>(() => {});
  /** The next "continue" segment, requested early. Only valid if the story state hasn't changed since. */
  const prefetch = useRef<{ basis: StoryState; response: Promise<TurnResponse> } | null>(null);
  /** How many times in a row Teddy couldn't hear the child (after two, it just carries on). */
  const misses = useRef(0);
  /** True while Teddy is saying "Yes?" after hearing its name. */
  const answeringName = useRef(false);

  useEffect(
    () =>
      preloadQuickReplies(config.tts, [
        firstReply(true, isWakeWordSupported()),
        firstReply(false, isWakeWordSupported()),
        LINES.didntCatch,
        LINES.keepGoing,
      ]),
    [config.tts],
  );

  // Children can't read the screen, so Teddy speaks first: a greeting, then it listens.
  useEffect(() => {
    begin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop everything if the screen unmounts mid-story.
  useEffect(
    () => () => {
      runId.current++;
      speaking.current?.stop();
      listening.current?.cancel();
      stopWakeWord.current();
    },
    [],
  );

  /** The narrator voice service failed (expired key, no credits, offline): carry on with the built-in voice. */
  function switchToDefaultVoice() {
    ttsMode.current = "browser";
    setNotice("Switching to the default voice");
    setTimeout(() => setNotice(""), 6000);
  }

  /** Teddy says one of its own lines; resolves when finished (errors are ignored: it's best-effort). */
  function say(text: string): Promise<void> {
    const n = sayLine(text, stateRef.current.pacing.phase, ttsMode.current);
    speaking.current = n;
    return n.done.then(
      () => {},
      () => {},
    );
  }

  /** Greet the child by name. If the parent gave a story idea, start it; otherwise ask what they'd like. */
  async function begin() {
    const myRun = ++runId.current;
    const wake = isWakeWordSupported();
    const hello = greeting(stateRef.current, wake);
    if (stateRef.current.storyRequest) {
      // Write the opening while Teddy is still saying hello.
      const narration = sayLine(hello, "interactive", ttsMode.current);
      speaking.current = narration;
      runTurn("", "child_spoke", { text: hello, narration });
      return;
    }
    setStatus("speaking");
    await say(hello);
    if (myRun === runId.current) startListening("child_spoke");
  }

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
    const n = narrate(segment.narration, segment.phase, ttsMode.current);
    speaking.current = n;
    // Let the child interrupt by calling "Teddy!" (skipped if the narration itself says the name).
    stopWakeWord.current();
    if (isWakeWordSupported() && !containsWakeWord(segment.narration)) {
      stopWakeWord.current = listenForWakeWord(() => {
        if (myRun === runId.current) answerToName();
      });
    }
    // Nothing for the child to answer, so start writing the next part while this one plays.
    if (!segment.askForResponse && !segment.finished && prefetch.current?.basis !== stateRef.current) {
      const basis = stateRef.current;
      const response = takeTurn(basis, "", "continue");
      response.catch(() => {}); // a failed prefetch just means we ask again later
      prefetch.current = { basis, response };
    }
    try {
      const outcome = await n.done;
      if (myRun !== runId.current || outcome === "stopped") return;
      stopWakeWord.current();
      afterSegment(segment);
    } catch {
      if (myRun !== runId.current) return;
      stopWakeWord.current();
      if (ttsMode.current === "server" && "speechSynthesis" in window) {
        switchToDefaultVoice();
        speak(segment); // replay the same part in the built-in voice
      } else {
        fail("tts");
      }
    }
  }

  async function runTurn(
    transcript: string,
    event: TurnEvent,
    ack?: { text: string; narration: Narration },
    attempt = 0,
  ) {
    const myRun = ++runId.current;
    pendingTurn.current = { transcript, event };
    setStatus("thinking");
    setError(null);
    const basis = stateRef.current;
    const early = prefetch.current;
    prefetch.current = null;
    try {
      // StoryState only changes after a successful turn, so a failure here loses nothing.
      const res =
        event === "continue" && early?.basis === basis
          ? await early.response.catch(() => takeTurn(basis, "", "continue"))
          : await takeTurn(basis, transcript, event, ack?.text);
      if (ack) await ack.narration.done.catch(() => {}); // let the quick "Ooh!" finish first
      if (myRun !== runId.current) return;
      stateRef.current = res.state;
      setState(res.state);
      pendingTurn.current = null;
      lastSegment.current = res.segment;
      setNarration(res.segment.narration);
      if (!transcript) setLastHeard(""); // only show the child's words next to the reply to them
      speak(res.segment);
    } catch {
      if (myRun !== runId.current) return;
      // One quiet retry first: most failures are a brief hiccup (rate limit, network blip).
      if (attempt === 0) {
        setTimeout(() => myRun === runId.current && runTurn(transcript, event, undefined, 1), 1500);
        return;
      }
      fail("llm");
      say(LINES.tangled); // the child hears what happened; the grown-up sees the retry button
    }
  }

  /** Teddy couldn't hear the child: ask again once, out loud, then just carry on. */
  async function missedHearing(event: TurnEvent) {
    const myRun = ++runId.current;
    misses.current++;
    setStatus("speaking");
    if (misses.current <= 1) {
      await say(LINES.didntCatch);
      if (myRun === runId.current) startListening(event);
    } else {
      misses.current = 0;
      await say(LINES.keepGoing);
      if (myRun === runId.current) runTurn("", "continue");
    }
  }

  /**
   * @param afterQuestion the story just asked something. If the child stays quiet we
   *   don't nag — the story gently continues on its own (they may be falling asleep).
   * @param resumeIfSilent the child called "Teddy!" but then said nothing: just carry on.
   */
  async function startListening(event: TurnEvent, afterQuestion = false, resumeIfSilent = false) {
    const myRun = ++runId.current;
    setStatus("listening");
    setError(null);
    // "Ding-ding": your turn to talk. Wait for it to finish so the recording doesn't hear it.
    await chime("listen", stateRef.current.pacing.phase);
    if (myRun !== runId.current) return;
    const l = listen({ mode: config.stt, onLevel: setMicLevel, noSpeechTimeoutMs: afterQuestion ? 8000 : 10000 });
    listening.current = l;
    try {
      const text = (await l.result).trim();
      if (myRun !== runId.current) return;
      const isFirst = stateRef.current.pacing.segmentCount === 0;
      if (text) {
        misses.current = 0;
        chime("heard", stateRef.current.pacing.phase);
      }
      if (text || isFirst) {
        if (text) setLastHeard(text);
        // Respond instantly so the child knows they were heard, while the story is written.
        // The very first reply also teaches them they can say "Teddy" to interrupt
        // (or, if they stayed quiet, tells them Teddy will pick the story).
        let ack: { text: string; narration: Narration };
        if (isFirst) {
          const line = firstReply(!!text, isWakeWordSupported());
          ack = { text: line, narration: sayLine(line, "interactive", ttsMode.current) };
        } else {
          ack = quickReply(stateRef.current.pacing.phase, ttsMode.current);
        }
        speaking.current = ack.narration;
        runTurn(text, event, ack);
      } else if (afterQuestion) {
        runTurn("", "no_response");
      } else if (resumeIfSilent) {
        runTurn("", "continue");
      } else {
        missedHearing(event);
      }
    } catch (err) {
      if (myRun !== runId.current) return;
      // A blocked mic needs a grown-up (shown on screen); a hearing problem is said out loud.
      if (err instanceof MicError) fail("mic");
      else missedHearing(event);
    } finally {
      setMicLevel(0);
      if (listening.current === l) listening.current = null;
    }
  }

  /** The child called "Teddy!" mid-story: stop, answer "Yes?", and listen. */
  async function answerToName() {
    const myRun = ++runId.current;
    stopWakeWord.current();
    speaking.current?.stop();
    setStatus("listening"); // ears perk up right away
    setError(null);
    const reply = wakeReply(stateRef.current.pacing.phase, ttsMode.current);
    speaking.current = reply;
    answeringName.current = true;
    await reply.done.catch(() => {});
    answeringName.current = false;
    if (myRun === runId.current) startListening("interrupted", false, true);
  }

  /** The one big button. What it does depends on the current state. */
  function pressMic() {
    if (!audioUnlocked.current) {
      unlockAudio();
      warmUpChimes();
      audioUnlocked.current = true;
    }
    switch (status) {
      case "listening":
        if (listening.current) {
          listening.current.stop(); // done talking — send it now
        } else if (answeringName.current) {
          // Still saying "Yes?" after hearing its name: skip ahead and listen right away.
          runId.current++;
          speaking.current?.stop();
          answeringName.current = false;
          startListening("interrupted", false, true);
        }
        // (otherwise the "your turn" chime is still playing; listening starts in a moment)
        break;
      case "speaking":
        runId.current++;
        stopWakeWord.current();
        speaking.current?.stop();
        startListening("interrupted");
        break;
      case "ready":
        startListening("child_spoke");
        break;
      // "thinking" and "finished": ignore taps
    }
  }

  /** "Finish story" button: whatever is happening, have Teddy tell a short, peaceful ending now. */
  function finishStory() {
    if (status === "finished") return;
    runId.current++; // cancels anything in flight
    stopWakeWord.current();
    speaking.current?.stop();
    listening.current?.cancel();
    prefetch.current = null;
    if (stateRef.current.pacing.segmentCount === 0) return setStatus("finished"); // story hadn't started
    runTurn("", "wrap_up");
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

  return { state, status, narration, lastHeard, error, notice, micLevel, pressMic, retry, keepGoing, finishStory };
}
