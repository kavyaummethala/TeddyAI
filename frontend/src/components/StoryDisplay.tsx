import { useState } from "react";

interface Props {
  narration: string;
  lastHeard: string;
}

/** The current narration, kept dim and small so it never competes with the voice. Can be hidden. */
export function StoryDisplay({ narration, lastHeard }: Props) {
  const [visible, setVisible] = useState(true);
  if (!narration && !lastHeard) return null;
  return (
    <section className="story-text">
      <button className="link" onClick={() => setVisible((v) => !v)}>
        {visible ? "Hide words" : "Show words"}
      </button>
      {visible && (
        <>
          {lastHeard && <p className="story-text__heard">“{lastHeard}”</p>}
          <p className="story-text__narration">{narration}</p>
        </>
      )}
    </section>
  );
}
