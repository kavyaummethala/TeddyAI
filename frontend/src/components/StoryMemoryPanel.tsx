import type { StoryPhase, StoryState } from "../../../shared/types";

const PHASES: { id: StoryPhase; label: string }[] = [
  { id: "interactive", label: "Interactive" },
  { id: "settling", label: "Settling" },
  { id: "windDown", label: "Wind down" },
  { id: "ending", label: "Ending" },
];

/** A collapsed, grown-ups-only view of StoryState, handy for demos and for parents to peek. */
export function StoryMemoryPanel({ state }: { state: StoryState }) {
  const { story, pacing } = state;
  const progress = Math.min(100, Math.round((pacing.elapsedMinutes / pacing.targetDurationMinutes) * 100));
  return (
    <details className="memory">
      <summary>Story memory (for grown-ups)</summary>
      <div className="memory__body">
        <div className="phases">
          {PHASES.map((p) => (
            <span key={p.id} className={p.id === pacing.phase ? "phase phase--active" : "phase"}>
              {p.label}
            </span>
          ))}
        </div>
        <div className="progress" aria-label={`${progress}% through the story`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="memory__meta">
          ~{pacing.elapsedMinutes} of {pacing.targetDurationMinutes} min · {pacing.segmentCount} segments ·{" "}
          {state.interactionCount} child interactions
        </p>
        {story.title && <Field label="Title">{story.title}</Field>}
        {story.plan.length > 0 && (
          <Field label="Plot plan">
            <ol>
              {story.plan.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </Field>
        )}
        {story.characters.length > 0 && <Field label="Characters">{story.characters.join(" · ")}</Field>}
        {story.childChanges.length > 0 && <Field label="Changes the child made">{story.childChanges.join(" · ")}</Field>}
        {story.importantEvents.length > 0 && (
          <Field label="Key events">
            <ol>
              {story.importantEvents.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ol>
          </Field>
        )}
        {story.summary && <Field label="Summary">{story.summary}</Field>}
      </div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="memory__field">
      <h4>{label}</h4>
      <div>{children}</div>
    </div>
  );
}
