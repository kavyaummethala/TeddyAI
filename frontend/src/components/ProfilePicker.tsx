import type { ChildProfile } from "../services/profiles";

interface Props {
  profiles: ChildProfile[];
  selectedId: string | null;
  onSelect: (profile: ChildProfile) => void;
  onNew: () => void;
  onDelete: (profile: ChildProfile) => void;
}

/** "Who's going to bed?": one tap picks a saved child and fills in the form. */
export function ProfilePicker({ profiles, selectedId, onSelect, onNew, onDelete }: Props) {
  if (profiles.length === 0) return null;
  return (
    <section className="profiles" aria-label="Saved children">
      <h2>Who's going to bed?</h2>
      <div className="profiles__list">
        {profiles.map((p) => (
          <div key={p.id} className={p.id === selectedId ? "profile profile--active" : "profile"}>
            <button type="button" className="profile__pick" onClick={() => onSelect(p)}>
              <span className="profile__avatar" aria-hidden>
                {p.childName.charAt(0).toUpperCase()}
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
        ))}
        <button type="button" className={selectedId === null ? "profile profile--new profile--active" : "profile profile--new"} onClick={onNew}>
          + Add a child
        </button>
      </div>
    </section>
  );
}
