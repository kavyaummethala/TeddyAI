// "Teddy!" wake word: while Teddy narrates, listen for the child calling its name so they can
// interrupt hands-free instead of tapping. Uses the browser's built-in speech recognition
// (Chrome, Edge, Safari), which streams words as they're heard, so it reacts within ~1s.
//
// The narrator's own voice is picked up by the mic too, but it never says "Teddy" (the story
// prompt forbids it, and the session skips wake-word listening if a segment contains it), so
// only the child calling the name triggers it.

// Children's speech and recognition errors produce variants of the name.
const WAKE_WORD = /\b(teddy|teddie|teddi|tedy|tedi|tetty|teddys?)\b/i;

export function containsWakeWord(text: string): boolean {
  return WAKE_WORD.test(text);
}

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | undefined {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Recognition) | undefined;
}

export function isWakeWordSupported(): boolean {
  return !!recognitionClass();
}

/** Starts listening for "Teddy". Calls onWake once, then stops. Returns a function that stops listening. */
export function listenForWakeWord(onWake: () => void): () => void {
  const Rec = recognitionClass();
  if (!Rec) return () => {};

  let stopped = false;
  let recognition: Recognition | null = null;

  const start = () => {
    if (stopped) return;
    recognition = new Rec();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true; // react to "Teddy" before the sentence is finished
    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (containsWakeWord(e.results[i][0].transcript)) {
          stop();
          onWake();
          return;
        }
      }
    };
    recognition.onerror = (e) => {
      // Permission problems won't fix themselves; stop quietly (tapping still works).
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") stopped = true;
    };
    // Browsers end recognition after a pause or ~a minute; keep it going for the whole segment.
    recognition.onend = () => {
      if (!stopped) setTimeout(start, 250);
    };
    try {
      recognition.start();
    } catch {
      stopped = true;
    }
  };

  const stop = () => {
    stopped = true;
    try {
      recognition?.abort();
    } catch {
      // already stopped
    }
  };

  start();
  return stop;
}
