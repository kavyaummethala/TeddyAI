import type { ChildProfile } from "../services/profiles";

interface Props {
  profiles: ChildProfile[];
  selectedIds: string[];
  onToggle: (profile: ChildProfile) => void;
  onNew: () => void;
  onDelete: (profile: ChildProfile) => void;
}

/** "Who's going to bed?": tap one child, or several for a shared story. */
export function ProfilePicker({ profiles, selectedIds, onToggle, onNew, onDelete }: Props) {
  if (profiles.length === 0) return null;
  return (
    <section className="profiles" aria-label="Saved children">
      <h2>Who's going to bed?</h2>
      {profiles.length > 1 && <p className="muted tiny profiles__hint">Tap more than one child for a story they share.</p>}
      <div className="profiles__list">
        {profiles.map((p) => {
          const active = selectedIds.includes(p.id);
          return (
            <div key={p.id} className={active ? "profile profile--active" : "profile"}>
              <button type="button" className="profile__pick" onClick={() => onToggle(p)} aria-pressed={active}>
                <span className="profile__avatar" aria-hidden>
                  {active ? "✓" : p.childName.charAt(0).toUpperCase()}
                </span>
                <span className="profile__text">
                  <strong>{p.childName}</strong>
                  <small>
                    {p.childAge} · {p.interests.slice(0, 2).join(", ") || "any story"}
                  </small>
                </span>
              </button>
              <button
                type="button"
                className="profile__delete"
                aria-label={`Remove ${p.childName}`}
                onClick={() => {
                  if (confirm(`Remove ${p.childName} from this device?`)) onDelete(p);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className={selectedIds.length === 0 ? "profile profile--new profile--active" : "profile profile--new"}
          onClick={onNew}
        >
          + Add a child
        </button>
      </div>
    </section>
  );
}
