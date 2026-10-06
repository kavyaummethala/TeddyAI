import { useEffect, useState } from "react";
import type { AppConfig, ParentSetup, StoryState } from "../../shared/types";
import { Setup } from "./pages/Setup";
import { Story } from "./pages/Story";
import { getConfig, startStory } from "./services/api";
import { loadProfiles } from "./services/profiles";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [story, setStory] = useState<StoryState | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  /** Which child the setup screen should show when we go back to it. */
  const [preselect, setPreselect] = useState<string | undefined>();

  useEffect(() => {
    getConfig().then(setConfig, () => setConfigError("Can't reach the Teddy backend. Is `npm run dev` running?"));
  }, []);

  async function handleStart(setup: ParentSetup, id: string | null) {
    const state = await startStory(setup);
    setProfileId(id);
    setStory(state);
  }

  function backToSetup(select: string | undefined) {
    setPreselect(select);
    setStory(null);
  }

  if (story && config) {
    return (
      <Story
        // A new key per story so switching children always starts a fresh session.
        key={story.child.name + story.pacing.targetDurationMinutes + String(profileId)}
        initialState={story}
        config={config}
        profiles={loadProfiles()}
        currentProfileId={profileId}
        onExit={() => backToSetup(profileId ?? undefined)}
        onSwitchChild={(id) => backToSetup(id ?? "new")}
      />
    );
  }

  const note = configError
    ? configError
    : config && config.llm.startsWith("mock")
      ? "Running in offline demo mode (scripted story). Add a GROQ_API_KEY to .env for real AI stories."
      : undefined;
  return <Setup key={preselect ?? "default"} onStart={handleStart} providerNote={note} preselect={preselect} />;
}
