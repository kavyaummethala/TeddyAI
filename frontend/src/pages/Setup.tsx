import { useState } from "react";
import type { ParentSetup } from "../../../shared/types";
import { ProfilePicker } from "../components/ProfilePicker";
import { deleteProfile, lastUsedProfileId, loadProfiles, saveProfile, type ChildProfile } from "../services/profiles";

interface Props {
  /** profileId is the saved child profile this story is for (null if not saved). */
  onStart: (setup: ParentSetup, profileId: string | null) => Promise<void>;
  /** Which child to show first: a profile id, "new" for a blank form, or undefined for the last used. */
  preselect?: string;
  providerNote?: string;
}

const DEMO: ParentSetup = {
  childName: "Mia",
  childAge: 6,
  interests: ["space", "cats"],
  durationMinutes: 8,
  parentGoal: "Mia is nervous about starting school tomorrow. Help her feel more confident about trying unfamiliar things.",
  storyRequest: "",
};

/** Screen 1: the parent sets things up before handing over the device. */
export function Setup({ onStart, providerNote, preselect }: Props) {
  // Start with the child who had the last story (or the first saved child), already filled in.
  const [profiles, setProfiles] = useState(loadProfiles);
  const initial =
    preselect === "new"
      ? null
      : (profiles.find((p) => p.id === (preselect ?? lastUsedProfileId())) ?? profiles[0] ?? null);

  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.childName ?? "");
  const [age, setAge] = useState(String(initial?.childAge ?? 6));
  const [interests, setInterests] = useState(initial?.interests.join(", ") ?? "");
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 8);
  const [goal, setGoal] = useState("");
  const [request, setRequest] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function selectProfile(p: ChildProfile) {
    setSelectedId(p.id);
    setName(p.childName);
    setAge(String(p.childAge));
    setInterests(p.interests.join(", "));
    setDuration(p.durationMinutes);
    setGoal(""); // tonight's worries and ideas are per-night, never carried over
    setRequest("");
  }

  function newChild() {
    setSelectedId(null);
    setName("");
    setAge("6");
    setInterests("");
    setDuration(8);
    setGoal("");
    setRequest("");
  }

  function removeProfile(p: ChildProfile) {
    setProfiles(deleteProfile(p.id));
    if (p.id === selectedId) newChild();
  }

  function fillDemo() {
    setSelectedId(null);
    setName(DEMO.childName);
    setAge(String(DEMO.childAge));
    setInterests(DEMO.interests.join(", "));
    setDuration(DEMO.durationMinutes);
    setGoal(DEMO.parentGoal ?? "");
    setRequest("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const child = {
      childName: name.trim(),
      childAge: Number(age),
      interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
      durationMinutes: duration,
    };
    try {
      // Save first, so the story screen's sidebar can show this child among the others.
      let profileId: string | null = null;
      if (remember) {
        saveProfile({ ...child, id: selectedId ?? undefined });
        profileId = lastUsedProfileId();
      }
      await onStart({ ...child, parentGoal: goal.trim(), storyRequest: request.trim() }, profileId);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

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
        selectedId={selectedId}
        onSelect={selectProfile}
        onNew={newChild}
        onDelete={removeProfile}
      />

      <form className="card" onSubmit={submit}>
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

        <fieldset className="field">
          <span>Story length</span>
          <div className="segmented">
            {[5, 8, 10].map((m) => (
              <button type="button" key={m} className={duration === m ? "active" : ""} onClick={() => setDuration(m)}>
                {m} min
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>
            Anything on their mind? <em>(optional, private)</em>
          </span>
          <textarea
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={600}
            placeholder="She's nervous about her first day at a new school tomorrow. I'd like the story to reinforce being brave when trying something new."
          />
          <small className="muted">
            Teddy weaves this into the story's themes, like a character who finds their courage. It's never said out loud,
            and your child won't hear that you asked.
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

        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Remember {name.trim() || "this child"} on this device (name, age, interests, length)</span>
        </label>

        {error && <p className="error-text">{error}</p>}

        <button className="primary" disabled={busy}>
          {busy ? "Getting ready…" : "Start Bedtime Story"}
        </button>
        <button type="button" className="link" onClick={fillDemo}>
          Fill in demo (Mia, 6, space & cats)
        </button>
      </form>

      {providerNote && <p className="muted tiny center">{providerNote}</p>}
    </main>
  );
}
