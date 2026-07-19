/** Cross-user display names: local cache + CO tag sync. */

const PEER_NAMES_KEY = "co-messenger.peer-names";

type PeerNameStore = Record<string, string>;

const listeners = new Set<() => void>();
let revision = 0;
let memory: PeerNameStore = readStore();

function readStore(): PeerNameStore {
  try {
    const raw = localStorage.getItem(PEER_NAMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: PeerNameStore = {};
    for (const [did, name] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof name === "string" && name.trim()) out[did] = name.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: PeerNameStore): void {
  try {
    localStorage.setItem(PEER_NAMES_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

function emit(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

export function subscribePeerNames(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getPeerNamesRevision(): number {
  return revision;
}

export function getPeerName(did: string): string | undefined {
  return memory[did];
}

/** Remember a peer’s display name (no-op if empty or unchanged). */
export function rememberPeerName(did: string, name: string): void {
  const trimmed = name.trim();
  if (!did || !trimmed) return;
  if (memory[did] === trimmed) return;
  memory = { ...memory, [did]: trimmed };
  writeStore(memory);
  emit();
}

/** Merge many DID→name pairs from CO tags / invite payloads. */
export function rememberPeerNames(entries: Record<string, string>): void {
  let changed = false;
  const next = { ...memory };
  for (const [did, name] of Object.entries(entries)) {
    const trimmed = name.trim();
    if (!did || !trimmed) continue;
    if (next[did] === trimmed) continue;
    next[did] = trimmed;
    changed = true;
  }
  if (!changed) return;
  memory = next;
  writeStore(memory);
  emit();
}
