import { sessionClose, sessionOpen } from "./invoke";

/** One open session per CO for the app lifetime — avoids StrictMode close/reopen races. */
const sessions = new Map<string, Promise<string>>();

/**
 * Return a shared open session for `coId`, opening one if needed.
 * Failed opens are not cached so callers can retry after membership changes.
 *
 * @param coId - CO id to open (or reuse) a session for
 * @returns Promise of the shared session id string
 */
export function getSharedCoSession(coId: string): Promise<string> {
  let pending = sessions.get(coId);
  if (!pending) {
    pending = sessionOpen(coId).catch((err) => {
      sessions.delete(coId);
      throw err;
    });
    sessions.set(coId, pending);
  }
  return pending;
}

/**
 * Drop a cached session so the next open starts fresh (e.g. after membership activates).
 *
 * @param coId - CO id whose cached session should be closed and removed
 * @returns `void` (close runs in the background)
 */
export function invalidateSharedCoSession(coId: string): void {
  const pending = sessions.get(coId);
  sessions.delete(coId);
  if (!pending) return;
  void pending
    .then((session) => sessionClose(session))
    .catch(() => {
      // ignore close errors for unused / failed opens
    });
}

/**
 * Close every cached session (used on page unload).
 *
 * @returns Resolves when all known sessions have been closed (errors ignored)
 */
export async function closeAllSharedCoSessions(): Promise<void> {
  const pending = [...sessions.values()];
  sessions.clear();
  await Promise.all(
    pending.map(async (open) => {
      try {
        await sessionClose(await open);
      } catch {
        // ignore close errors during teardown
      }
    }),
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void closeAllSharedCoSessions();
  });
}
