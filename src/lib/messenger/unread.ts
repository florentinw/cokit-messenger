const LAST_READ_KEY = "co-messenger.last-read";

type LastReadStore = Record<string, number>;

function readStore(): LastReadStore {
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: LastReadStore = {};
    for (const [coId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) out[coId] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: LastReadStore): void {
  try {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

/** Last time this chat was marked read, or `undefined` if never opened. */
export function getLastReadAt(coId: string): number | undefined {
  return readStore()[coId];
}

/** Advance the read watermark (never moves backwards). */
export function markChatRead(coId: string, at = Date.now()): void {
  const store = readStore();
  store[coId] = Math.max(store[coId] ?? 0, at);
  writeStore(store);
}

export function countUnreadMessages(
  messages: Array<{ from: string; timestamp: number }>,
  identity: string | undefined,
  lastReadAt: number,
): number {
  return messages.reduce((count, message) => {
    if (message.timestamp <= lastReadAt) return count;
    if (identity && message.from === identity) return count;
    return count + 1;
  }, 0);
}
