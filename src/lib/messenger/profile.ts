import type { Did } from "@/lib/co-sdk/identity";
import {
  profileNameFromLocalCo,
  setLocalCoProfileName,
} from "@/lib/messenger/tags";

/** Sync cache of the local-CO profile name (empty until hydrated). */
let cachedName = "";
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function setCachedName(name: string): void {
  const trimmed = name.trim();
  if (cachedName === trimmed) return;
  cachedName = trimmed;
  notify();
}

export function subscribeProfileName(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function readProfileName(): string {
  return cachedName;
}

/** Load the profile name from the local CO into the sync cache. */
export async function hydrateProfileName(localSession: string): Promise<string> {
  let name = "";
  try {
    name = await profileNameFromLocalCo(localSession);
  } catch (err) {
    console.warn("Failed to read profile name from local CO", err);
  }
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
  setCachedName(trimmed);
}
