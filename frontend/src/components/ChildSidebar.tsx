import type { ChildProfile } from "../services/profiles";

interface Props {
  childName: string;
  childAge: number;
  profiles: ChildProfile[];
  currentProfileId: string | null;
  storyInProgress: boolean;
  /** Mobile only: the sidebar is a drawer. On wide screens it's always visible. */
  open: boolean;
  onClose: () => void;
  /** Leave this story and set one up for another child (null = add a new child). */
  onSwitchChild: (profileId: string | null) => void;
  onGrownUps: () => void;
}

/** Shows who tonight's story is for, and lets a parent with several children switch in one tap. */
export function ChildSidebar(props: Props) {
  const { childName, childAge, profiles, currentProfileId, storyInProgress, open, onClose } = props;
  const others = profiles.filter((p) => p.id !== currentProfileId);

  function switchTo(profileId: string | null, label: string) {
    if (storyInProgress && !confirm(`End ${childName}'s story and set one up for ${label}?`)) return;
    props.onSwitchChild(profileId);
  }

  return (
    <>
      {open && <div className="sidebar__backdrop" onClick={onClose} />}
      <aside className={open ? "sidebar sidebar--open" : "sidebar"} aria-label="Children">
        <div className="sidebar__brand">
          🧸 Teddy
          <button className="sidebar__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="sidebar__label">Story for</p>
        <div className="sidebar__current">
          <span className="profile__avatar">{childName.charAt(0).toUpperCase()}</span>
          <span className="profile__text">
            <strong>{childName}</strong>
            <small>Age {childAge}</small>
          </span>
        </div>

        {others.length > 0 && <p className="sidebar__label">Other children</p>}
        <ul className="sidebar__list">
          {others.map((p) => (
            <li key={p.id}>
              <button className="sidebar__child" onClick={() => switchTo(p.id, p.childName)}>
                <span className="profile__avatar profile__avatar--small">{p.childName.charAt(0).toUpperCase()}</span>
                <span>
                  {p.childName} <small className="muted">· {p.childAge}</small>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button className="sidebar__child sidebar__child--add" onClick={() => switchTo(null, "another child")}>
              + Add a child
            </button>
          </li>
        </ul>

        <button className="link sidebar__grownups" onClick={props.onGrownUps}>
          ← Grown-ups
        </button>
      </aside>
    </>
  );
}
