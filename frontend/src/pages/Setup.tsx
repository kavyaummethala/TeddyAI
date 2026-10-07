import { useState } from "react";
import type { ChildInfo, ParentSetup } from "../../../shared/types";
import { ProfilePicker } from "../components/ProfilePicker";
import { listNames } from "../services/format";
import {
  deleteProfile,
  lastDuration,
  lastUsedProfileId,
  loadProfiles,
  rememberDuration,
  saveProfile,
  type ChildProfile,
} from "../services/profiles";

interface Props {
  /** profileIds are the saved children this story is for (empty if not saved). */
  onStart: (setup: ParentSetup, profileIds: string[]) => Promise<void>;
  /** Which children to select first: profile ids, "new" for a blank form, or undefined for the last used. */
  preselect?: string[] | "new";
  providerNote?: string;
}

const MIN_MINUTES = 1;
const MAX_MINUTES = 15;

const DEMO = {
  childName: "Mia",
  childAge: 6,
  interests: ["space", "cats"],
  durationMinutes: 8,
  parentGoal: "Mia is nervous about starting school tomorrow. Help her feel more confident about trying unfamiliar things.",
};

/** Screen 1: the parent picks who's going to bed (one child or several) and sets up tonight's story. */
export function Setup({ onStart, preselect, providerNote }: Props) {
  const [profiles, setProfiles] = useState(loadProfiles);

  const initialIds = (() => {
    if (preselect === "new") return [];
    const wanted = preselect ?? [lastUsedProfileId() ?? profiles[0]?.id];
    return wanted.filter((id): id is string => !!id && profiles.some((p) => p.id === id));
  })();
  const first = profiles.find((p) => p.id === initialIds[0]);

  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  // Details form, used when the story is for one child (or a new one).
  const [name, setName] = useState(first?.childName ?? "");
  const [age, setAge] = useState(String(first?.childAge ?? 6));
  const [interests, setInterests] = useState(first?.interests.join(", ") ?? "");
  const [duration, setDuration] = useState(lastDuration() ?? first?.durationMinutes ?? 8);
  const [goal, setGoal] = useState("");
  const [request, setRequest] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = selectedIds.map((id) => profiles.find((p) => p.id === id)).filter((p): p is ChildProfile => !!p);
  const several = selected.length > 1;

  function fillForm(p: ChildProfile | undefined) {
    setName(p?.childName ?? "");
    setAge(String(p?.childAge ?? 6));
    setInterests(p?.interests.join(", ") ?? "");
  }

  /** Tapping a child adds them to (or removes them from) tonight's story. */
  function toggleProfile(p: ChildProfile) {
    const next = selectedIds.includes(p.id) ? selectedIds.filter((id) => id !== p.id) : [...selectedIds, p.id];
    setSelectedIds(next);
    if (next.length === 1) fillForm(profiles.find((x) => x.id === next[0]));
    if (next.length === 0) fillForm(undefined);
    setGoal(""); // tonight's worries and ideas are per-night, never carried over
    setRequest("");
  }

  function newChild() {
    setSelectedIds([]);
    fillForm(undefined);
    setGoal("");
    setRequest("");
  }

  function removeProfile(p: ChildProfile) {
    setProfiles(deleteProfile(p.id));
    setSelectedIds((ids) => ids.filter((id) => id !== p.id));
  }

  function fillDemo() {
    setSelectedIds([]);
    setName(DEMO.childName);
    setAge(String(DEMO.childAge));
    setInterests(DEMO.interests.join(", "));
    setDuration(DEMO.durationMinutes);
    setGoal(DEMO.parentGoal);
    setRequest("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let children: ChildInfo[];
      let profileIds: string[];
      if (several) {
        children = selected.map((p) => ({ name: p.childName, age: p.childAge, interests: p.interests }));
        profileIds = selected.map((p) => p.id);
      } else {
        const child = { name: name.trim(), age: Number(age), interests: interests.split(",").map((s) => s.trim()).filter(Boolean) };
        children = [child];
        profileIds = [];
        // Save first, so the story screen's sidebar can list this child.
        if (remember) {
          const list = saveProfile({
            id: selectedIds[0],
            childName: child.name,
            childAge: child.age,
            interests: child.interests,
            durationMinutes: duration,
          });
          setProfiles(list);
          profileIds = [lastUsedProfileId()].filter((id): id is string => !!id);
        }
      }
      // Recent stories these children heard, so tonight's story is different.
      const recentStories = [
        ...new Set(
          loadProfiles()
            .filter((p) => profileIds.includes(p.id))
            .flatMap((p) => (p.recentStories ?? []).map((s) => s.text)),
        ),
      ].slice(-6);

      rememberDuration(duration);
      await onStart(
        { children, durationMinutes: duration, parentGoal: goal.trim(), storyRequest: request.trim(), recentStories },
        profileIds,
      );
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const minds = several ? "Anything on their minds?" : "Anything on their mind?";

  return (
    <main className="setup">
      <header className="setup__header">
        <div className="brand">🧸 Teddy</div>
        <h1>Set up tonight's bedtime story</h1>
        <p className="muted">
          Tell Teddy a little about your child. Then hand over the device. Your child just talks, and Teddy tells the story
          out loud.
        </p>
      </header>

      <ProfilePicker
        profiles={profiles}
        selectedIds={selectedIds}
        onToggle={toggleProfile}
        onNew={newChild}
        onDelete={removeProfile}
      />

      <form className="card" onSubmit={submit}>
        {several ? (
          <div className="together">
            <p className="together__title">One story for {listNames(selected.map((p) => p.childName))}</p>
            <ul>
              {selected.map((p) => (
                <li key={p.id}>
                  <strong>{p.childName}</strong>, {p.childAge} · {p.interests.join(", ") || "any story"}
                </li>
              ))}
            </ul>
            <small className="muted">
              Teddy uses words the youngest will understand, mixes in everyone's interests, and gives each child a turn to
              choose. Tap a single child above to edit their details.
            </small>
          </div>
        ) : (
          <>
            <div className="row">
              <label className="field">
                <span>Child's name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mia" required maxLength={40} />
              </label>
              <label className="field field--small">
                <span>Age</span>
                <input type="number" min={2} max={12} value={age} onChange={(e) => setAge(e.target.value)} required />
              </label>
            </div>

            <label className="field">
              <span>Interests</span>
              <input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="space, cats, dinosaurs" />
            </label>
          </>
        )}

        <label className="field">
          <span className="slider__label">
            Story length <strong>{duration} min</strong>
          </span>
          <input
            className="slider"
            type="range"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            step={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ "--fill": `${((duration - MIN_MINUTES) / (MAX_MINUTES - MIN_MINUTES)) * 100}%` } as React.CSSProperties}
          />
          <span className="slider__ends muted">
            <span>{MIN_MINUTES} min</span>
            <span>{MAX_MINUTES} min</span>
          </span>
        </label>

        <label className="field">
          <span>
            {minds} <em>(optional, private)</em>
          </span>
          <textarea
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={600}
            placeholder={
              several
                ? "Leo is nervous about the dentist tomorrow, and Mia has been sharing her toys more. I'd love the story to celebrate both."
                : "She's nervous about her first day at a new school tomorrow. I'd like the story to reinforce being brave when trying something new."
            }
          />
          <small className="muted">
            Teddy weaves this into the story's themes, like a character who finds their courage. It's never said out loud,
            and your {several ? "children won't" : "child won't"} hear that you asked.
          </small>
        </label>

        <label className="field">
          <span>
            Story idea <em>(optional)</em>
          </span>
          <input
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            maxLength={300}
            placeholder="A cat exploring outer space. Or leave blank and let your child ask."
          />
        </label>

        {!several && (
          <label className="checkbox">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Remember {name.trim() || "this child"} on this device (name, age, interests, length)</span>
          </label>
        )}

        {error && <p className="error-text">{error}</p>}

        <button className="primary" disabled={busy}>
          {busy ? "Getting ready…" : several ? `Start story for ${listNames(selected.map((p) => p.childName))}` : "Start Bedtime Story"}
        </button>
        <button type="button" className="link" onClick={fillDemo}>
          Fill in demo (Mia, 6, space & cats)
        </button>
      </form>

      {providerNote && <p className="muted tiny center">{providerNote}</p>}
    </main>
  );
}
