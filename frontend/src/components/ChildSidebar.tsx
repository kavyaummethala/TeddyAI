import type { ChildInfo } from "../../../shared/types";
import { listNames } from "../services/format";
import type { ChildProfile } from "../services/profiles";

interface Props {
  /** Everyone hearing this story. */
  listeners: ChildInfo[];
  profiles: ChildProfile[];
  currentProfileIds: string[];
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
  const { listeners, profiles, currentProfileIds, storyInProgress, open, onClose } = props;
  const others = profiles.filter((p) => !currentProfileIds.includes(p.id));
  const childName = listNames(listeners.map((c) => c.name));

  function switchTo(profileId: string | null, label: string) {
    if (storyInProgress && !confirm(`End the story for ${childName} and set one up for ${label}?`)) return;
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
        {listeners.map((c) => (
          <div key={c.name} className="sidebar__current">
            <span className="profile__avatar">{c.name.charAt(0).toUpperCase()}</span>
            <span className="profile__text">
              <strong>{c.name}</strong>
              <small>Age {c.age}</small>
            </span>
          </div>
        ))}

        {others.length > 0 && <p className="sidebar__label">{currentProfileIds.length ? "Other children" : "Saved children"}</p>}
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
