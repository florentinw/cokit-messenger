const PROFILE_NAME_KEY = "co-messenger.profile-name";

let revision = 0;
const listeners = new Set<() => void>();

function notify() {
  revision += 1;
  for (const listener of listeners) listener();
}

export function subscribeProfileName(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getProfileNameRevision(): number {
  return revision;
}

export function readProfileName(): string {
  try {
    return localStorage.getItem(PROFILE_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeProfileName(name: string): void {
  const trimmed = name.trim();
  try {
    if (trimmed) localStorage.setItem(PROFILE_NAME_KEY, trimmed);
    else localStorage.removeItem(PROFILE_NAME_KEY);
  } catch {
    // ignore quota / private mode
  }
  notify();
}
