import { useEffect, useState } from "react";
import type { AppConfig, ParentSetup, StoryState } from "../../shared/types";
import { Setup } from "./pages/Setup";
import { Story } from "./pages/Story";
import { getConfig, startStory } from "./services/api";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [story, setStory] = useState<StoryState | null>(null);

  useEffect(() => {
    getConfig().then(setConfig, () => setConfigError("Can't reach the Teddy backend. Is `npm run dev` running?"));
  }, []);

  async function handleStart(setup: ParentSetup) {
    setStory(await startStory(setup));
  }

  if (story && config) return <Story initialState={story} config={config} onExit={() => setStory(null)} />;

  const note = configError
    ? configError
    : config && config.llm.startsWith("mock")
      ? "Running in offline demo mode (scripted story). Add a GEMINI_API_KEY to .env for real AI stories."
      : undefined;
  return <Setup onStart={handleStart} providerNote={note} />;
}
