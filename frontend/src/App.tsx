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
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [storyId, setStoryId] = useState("");
  /** Which children the setup screen should select when we go back to it. */
  const [preselect, setPreselect] = useState<string[] | "new" | undefined>();

  useEffect(() => {
    getConfig().then(setConfig, () => setConfigError("Can't reach the Teddy backend. Is `npm run dev` running?"));
  }, []);

  async function handleStart(setup: ParentSetup, ids: string[]) {
    const state = await startStory(setup);
    setProfileIds(ids);
    setStoryId(crypto.randomUUID());
    setStory(state);
  }

  function backToSetup(select: string[] | "new" | undefined) {
    setPreselect(select);
    setStory(null);
  }

  if (story && config) {
    return (
      <Story
        // A new key per story so every story starts a fresh session.
        key={storyId}
        storyId={storyId}
        initialState={story}
        config={config}
        profiles={loadProfiles()}
        currentProfileIds={profileIds}
        onExit={() => backToSetup(profileIds.length ? profileIds : undefined)}
        onSwitchChild={(id) => backToSetup(id ? [id] : "new")}
      />
    );
  }

  const note = configError
    ? configError
    : config && config.llm.startsWith("mock")
      ? "Running in offline demo mode (scripted story). Add a GROQ_API_KEY to .env for real AI stories."
      : undefined;
  return (
    <Setup
      key={preselect === undefined ? "default" : String(preselect)}
      onStart={handleStart}
      providerNote={note}
      preselect={preselect}
    />
  );
}
