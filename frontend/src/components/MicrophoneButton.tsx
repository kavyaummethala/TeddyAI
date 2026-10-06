import type { StoryPhase } from "../../../shared/types";
import type { SessionStatus } from "../hooks/useStorySession";
import { TeddyBear } from "./TeddyBear";

interface Props {
  status: SessionStatus;
  phase: StoryPhase;
  level: number; // 0..1 mic volume while listening
  onPress: () => void;
}

const LABELS: Record<SessionStatus, string> = {
  ready: "Tap Teddy to talk",
  listening: "Listening. Tap when you're done talking",
  thinking: "Teddy is thinking",
  speaking: "Teddy is telling your story. Tap or say Teddy to interrupt",
  finished: "The story is finished",
};

/** Teddy the bear: the big microphone button, and the only control a child needs. */
export function MicrophoneButton({ status, phase, level, onPress }: Props) {
  return (
    <button
      className={`teddy teddy--${status}`}
      style={{ "--level": level } as React.CSSProperties}
      onClick={onPress}
      disabled={status === "thinking" || status === "finished"}
      aria-label={LABELS[status]}
    >
      <span className="teddy__glow" />
      <span className="teddy__ring" />
      <span className="teddy__ring teddy__ring--2" />
      <span className="teddy__face">
        <TeddyBear status={status} phase={phase} />
      </span>
    </button>
  );
}
