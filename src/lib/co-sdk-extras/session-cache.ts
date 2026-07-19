import { sessionClose, sessionOpen } from "./invoke";

/** One open session per CO for the app lifetime — avoids StrictMode close/reopen races. */
const sessions = new Map<string, Promise<string>>();

export function getSharedCoSession(coId: string): Promise<string> {
  let pending = sessions.get(coId);
  if (!pending) {
    pending = sessionOpen(coId).catch((err) => {
      // Don't cache failures — e.g. open before membership is Active, then retry after Join completes.
      sessions.delete(coId);
      throw err;
    });
    sessions.set(coId, pending);
  }
  return pending;
}

/** Drop a cached session so the next open starts fresh (e.g. after membership activates). */
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
