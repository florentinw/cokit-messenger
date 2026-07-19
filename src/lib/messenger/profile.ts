import type { Did } from "@/lib/co-sdk/identity";
import {
  profileNameFromLocalCo,
  setLocalCoProfileName,
} from "@/lib/messenger/tags";

/** Legacy web-storage key; migrated into the local CO on first hydrate. */
const LEGACY_PROFILE_NAME_KEY = "co-messenger.profile-name";

let cachedName = "";
let revision = 0;
const listeners = new Set<() => void>();

function notify() {
  revision += 1;
  for (const listener of listeners) listener();
}

function setCachedName(name: string): void {
  const trimmed = name.trim();
  if (cachedName === trimmed) return;
  cachedName = trimmed;
  notify();
}

function readLegacyLocalStorage(): string {
  try {
    return localStorage.getItem(LEGACY_PROFILE_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function clearLegacyLocalStorage(): void {
  try {
    localStorage.removeItem(LEGACY_PROFILE_NAME_KEY);
  } catch {
    // ignore quota / private mode
  }
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

/** Synchronous cache of the local-CO profile name (empty until hydrated). */
export function readProfileName(): string {
  return cachedName;
}

/**
 * Load the profile name from the local CO into the sync cache.
 * Migrates a legacy `localStorage` value once if the CO tag is empty.
 */
export async function hydrateProfileName(
  localSession: string,
  identity: Did,
): Promise<string> {
  let name = "";
  try {
    name = await profileNameFromLocalCo(localSession);
  } catch (err) {
    console.warn("Failed to read profile name from local CO", err);
  }

  if (!name) {
    const legacy = readLegacyLocalStorage();
    if (legacy) {
      try {
        await setLocalCoProfileName(localSession, identity, legacy);
        name = legacy;
      } catch (err) {
        console.warn("Failed to migrate profile name into local CO", err);
        name = legacy;
      }
    }
  }

  clearLegacyLocalStorage();
  setCachedName(name);
  return name;
}

/** Persist the profile name on the local CO and update the sync cache. */
export async function persistProfileName(
  localSession: string,
  identity: Did,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await setLocalCoProfileName(localSession, identity, trimmed);
  clearLegacyLocalStorage();
  setCachedName(trimmed);
}
