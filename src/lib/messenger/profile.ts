const PROFILE_NAME_KEY = "co-messenger.profile-name";

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
}
