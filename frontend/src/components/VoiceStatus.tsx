import type { SessionStatus } from "../hooks/useStorySession";

interface Props {
  status: SessionStatus;
  childName: string;
  isStart: boolean;
}

/** One short line under the moon. Big and simple, so a pre-reader can follow from the animation alone. */
export function VoiceStatus({ status, childName, isStart }: Props) {
  const text: Record<SessionStatus, string> = {
    ready: isStart ? `Hi ${childName}! Tap the moon and tell me a story idea` : "Tap the moon to talk",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Telling your story…",
    finished: `Goodnight, ${childName}`,
  };
  return (
    <p className="status" aria-live="polite">
      {text[status]}
    </p>
  );
}
