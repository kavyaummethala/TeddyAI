// Saved child profiles, kept in this browser's localStorage (no accounts, no server database).
// Only the stable details are saved. "What's on their mind tonight" changes nightly, so it isn't.

export interface ChildProfile {
  id: string;
  childName: string;
  childAge: number;
  interests: string[];
  durationMinutes: number;
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

export function lastUsedProfileId(): string | null {
  return read<string | null>(LAST_KEY, null);
}

/** Creates or updates a profile. A child with the same name (any capitalization) is updated, not duplicated. */
export function saveProfile(profile: Omit<ChildProfile, "id"> & { id?: string }): ChildProfile[] {
  const profiles = loadProfiles();
  const existing = profiles.find(
    (p) => p.id === profile.id || p.childName.trim().toLowerCase() === profile.childName.trim().toLowerCase(),
  );
  const saved: ChildProfile = { ...profile, id: existing?.id ?? profile.id ?? crypto.randomUUID() };
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
