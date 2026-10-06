import { useState } from "react";
import type { AppConfig, StoryState } from "../../../shared/types";
import { ChildSidebar } from "../components/ChildSidebar";
import { MicrophoneButton } from "../components/MicrophoneButton";
import { StoryDisplay } from "../components/StoryDisplay";
import { StoryMemoryPanel } from "../components/StoryMemoryPanel";
import { VoiceStatus } from "../components/VoiceStatus";
import { useStorySession } from "../hooks/useStorySession";
import type { ChildProfile } from "../services/profiles";

interface Props {
  initialState: StoryState;
  config: AppConfig;
  profiles: ChildProfile[];
  currentProfileId: string | null;
  onExit: () => void;
  onSwitchChild: (profileId: string | null) => void;
}

/** Screen 2: dark, minimal, voice-first. The page itself gets dimmer as the story winds down. */
export function Story({ initialState, config, profiles, currentProfileId, onExit, onSwitchChild }: Props) {
  const session = useStorySession(initialState, config);
  const { state, status, error } = session;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className="story" data-phase={state.pacing.phase} data-status={status}>
      <div className="sky" aria-hidden />
      {session.notice && (
        <div className="notice" role="status">
          {session.notice}
        </div>
      )}
      <ChildSidebar
        childName={state.child.name}
        childAge={state.child.age}
        profiles={profiles}
        currentProfileId={currentProfileId}
        storyInProgress={status !== "finished" && state.pacing.segmentCount > 0}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSwitchChild={onSwitchChild}
        onGrownUps={onExit}
      />
      <header className="story__top">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Show children">
          <span className="profile__avatar profile__avatar--small">{state.child.name.charAt(0).toUpperCase()}</span>
          Story for {state.child.name} ▾
        </button>
        {status !== "finished" && (
          <button className="pill" onClick={session.finishStory}>
            ☾ Finish story
          </button>
        )}
      </header>

      <section className="story__center">
        <MicrophoneButton status={status} phase={state.pacing.phase} level={session.micLevel} onPress={session.pressMic} />
        <VoiceStatus status={status} childName={state.child.name} isStart={state.pacing.segmentCount === 0} />
        {status === "speaking" && <p className="hint">Say “Teddy” or tap to talk</p>}

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
