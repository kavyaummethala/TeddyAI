import type { AppConfig, StoryState } from "../../../shared/types";
import { MicrophoneButton } from "../components/MicrophoneButton";
import { StoryDisplay } from "../components/StoryDisplay";
import { StoryMemoryPanel } from "../components/StoryMemoryPanel";
import { VoiceStatus } from "../components/VoiceStatus";
import { useStorySession } from "../hooks/useStorySession";

interface Props {
  initialState: StoryState;
  config: AppConfig;
  onExit: () => void;
}

/** Screen 2: dark, minimal, voice-first. The page itself gets dimmer as the story winds down. */
export function Story({ initialState, config, onExit }: Props) {
  const session = useStorySession(initialState, config);
  const { state, status, error } = session;

  return (
    <main className="story" data-phase={state.pacing.phase} data-status={status}>
      <div className="sky" aria-hidden />
      {session.notice && (
        <div className="notice" role="status">
          {session.notice}
        </div>
      )}
      <header className="story__top">
        <button className="link" onClick={onExit}>
          ← Grown-ups
        </button>
        {status !== "finished" && (
          <button className="pill" onClick={session.finishStory}>
            ☾ Finish story
          </button>
        )}
      </header>

      <section className="story__center">
        <MicrophoneButton status={status} level={session.micLevel} onPress={session.pressMic} />
        <VoiceStatus status={status} childName={state.child.name} isStart={state.pacing.segmentCount === 0} />

        {error && (
          <div className="error-box" role="alert">
            <p>{error.message}</p>
            <div className="error-box__actions">
              <button className="primary small" onClick={session.retry}>
                {error.kind === "tts" ? "Retry audio" : "Try again"}
              </button>
              {state.pacing.segmentCount > 0 && (
                <button className="link" onClick={session.keepGoing}>
                  Keep the story going
                </button>
              )}
            </div>
          </div>
        )}

        {status === "finished" && (
          <button className="link" onClick={onExit}>
            Start a new story
          </button>
        )}
      </section>

      <footer className="story__bottom">
        <StoryDisplay narration={session.narration} lastHeard={session.lastHeard} />
        <StoryMemoryPanel state={state} />
        <p className="tiny muted center">Story engine: {config.llm}</p>
      </footer>
    </main>
  );
}
