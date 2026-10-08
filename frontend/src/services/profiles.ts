// Saved child profiles, kept in this browser's localStorage (no accounts, no server database).
// Only the stable details are saved. "What's on their mind tonight" changes nightly, so it isn't.

export interface ChildProfile {
  id: string;
  childName: string;
  childAge: number;
  interests: string[];
  durationMinutes: number;
  /** Hero names from the last few stories this child heard, so the next hero is someone new. */
  recentStories?: { storyId: string; text: string }[];
}

const KEY = "teddy.profiles.v1";
const LAST_KEY = "teddy.lastProfileId";

// Storage can be unavailable (private browsing, blocked site data), so every access is guarded
// and the app simply works without saving.
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore: saving is a convenience, not a requirement
  }
}

export function loadProfiles(): ChildProfile[] {
  const list = read<ChildProfile[]>(KEY, []);
  return Array.isArray(list) ? list.filter((p) => p && typeof p.childName === "string") : [];
}

const DURATION_KEY = "teddy.lastDuration";

/** The story length used last time, so the slider stays where the parent left it. */
export function lastDuration(): number | null {
  const n = read<number | null>(DURATION_KEY, null);
  return typeof n === "number" ? n : null;
}

export function rememberDuration(minutes: number) {
  write(DURATION_KEY, minutes);
}

export function lastUsedProfileId(): string | null {
  return read<string | null>(LAST_KEY, null);
}

/** Remembers a story for each child who heard it (replacing the entry if this story was already saved). */
export function rememberStory(profileIds: string[], storyId: string, text: string) {
  const next = loadProfiles().map((p) => {
    if (!profileIds.includes(p.id)) return p;
    const others = (p.recentStories ?? []).filter((s) => s.storyId !== storyId);
    return { ...p, recentStories: [...others, { storyId, text }].slice(-5) };
  });
  write(KEY, next);
}

/** Creates or updates a profile. A child with the same name (any capitalization) is updated, not duplicated. */
export function saveProfile(profile: Omit<ChildProfile, "id"> & { id?: string }): ChildProfile[] {
  const profiles = loadProfiles();
  const existing = profiles.find(
    (p) => p.id === profile.id || p.childName.trim().toLowerCase() === profile.childName.trim().toLowerCase(),
  );
  const saved: ChildProfile = {
    ...profile,
    id: existing?.id ?? profile.id ?? crypto.randomUUID(),
    recentStories: existing?.recentStories ?? [],
  };
  const next = existing ? profiles.map((p) => (p.id === existing.id ? saved : p)) : [...profiles, saved];
  write(KEY, next);
  write(LAST_KEY, saved.id);
  return next;
}

export function deleteProfile(id: string): ChildProfile[] {
  const next = loadProfiles().filter((p) => p.id !== id);
  write(KEY, next);
  return next;
}
