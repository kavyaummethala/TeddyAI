import type { SessionStatus } from "../hooks/useStorySession";

interface Props {
  status: SessionStatus;
  childName: string;
  isStart: boolean;
}

/** One short line under Teddy. Big and simple, so a pre-reader can follow from the animation alone. */
export function VoiceStatus({ status, childName, isStart }: Props) {
  const text: Record<SessionStatus, string> = {
    ready: isStart ? `Hi ${childName}! Tap me and tell me a story idea` : "Tap Teddy to talk",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: isStart ? `Hi ${childName}!` : "Telling your story…",
    finished: `Goodnight, ${childName}`,
  };
  return (
    <p className="status" aria-live="polite">
      {text[status]}
    </p>
  );
}
