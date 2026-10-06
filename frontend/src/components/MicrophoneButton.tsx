import type { SessionStatus } from "../hooks/useStorySession";

interface Props {
  status: SessionStatus;
  level: number; // 0..1 mic volume while listening
  onPress: () => void;
}

const LABELS: Record<SessionStatus, string> = {
  ready: "Tap to talk to Teddy",
  listening: "Listening. Tap when you're done talking",
  thinking: "Teddy is thinking",
  speaking: "Teddy is telling your story. Tap to interrupt",
  finished: "The story is finished",
};

/** The big glowing moon. The only control a child needs. */
export function MicrophoneButton({ status, level, onPress }: Props) {
  return (
    <button
      className={`moon moon--${status}`}
      style={{ "--level": level } as React.CSSProperties}
      onClick={onPress}
      disabled={status === "thinking" || status === "finished"}
      aria-label={LABELS[status]}
    >
      <span className="moon__ring" />
      <span className="moon__ring moon__ring--2" />
      <span className="moon__face">{status === "speaking" || status === "finished" ? <StarsIcon /> : status === "thinking" ? <DotsIcon /> : <MicIcon />}</span>
    </button>
  );
}

const MicIcon = () => (
  <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

const StarsIcon = () => (
  <svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor" aria-hidden>
    <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6zM18.5 13l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9zM6 15l.7 1.8 1.8.7-1.8.7L6 20l-.7-1.8-1.8-.7 1.8-.7z" />
  </svg>
);

const DotsIcon = () => (
  <span className="dots" aria-hidden>
    <i />
    <i />
    <i />
  </span>
);
