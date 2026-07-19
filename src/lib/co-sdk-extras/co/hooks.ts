import { useEffect, useState } from "react";
import { CID } from "multiformats";
import { getCoTip, resolveCid } from "./invoke";
import { listenCoState } from "./state-listener";
import { getSharedCoSession } from "./session-cache";

function headsKey(heads: CID[] | undefined): string {
  return heads?.map((h) => h.toString()).join("\0") ?? "";
}

/**
 * Open (or reuse) a shared session for `coId`.
 * Keeps the previous session id while re-opening to avoid loading flashes.
 *
 * @param coId - CO id to open a session for
 * @returns `{ sessionId, error }` — `sessionId` when open; `error` if open failed
 */
export function useCoSession(coId: string): {
  sessionId: string | undefined;
  error: Error | undefined;
} {
  const [session, setSession] = useState<string | undefined>();
  const [sessionError, setSessionError] = useState<Error | undefined>();

  useEffect(() => {
    let cancelled = false;

    void getSharedCoSession(coId)
      .then((opened) => {
        if (cancelled) return;
        setSession(opened);
        setSessionError(undefined);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSessionError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
    };
  }, [coId]);

  return { sessionId: session, error: sessionError };
}

/**
 * Subscribe to tip CID + heads for a CO (stale-while-revalidate).
 *
 * @param coId - CO id to follow
 * @returns `[tipCid, heads]`, or `[undefined, undefined]` before the first load
 */
export function useCoTip(coId: string): [CID | undefined, CID[] | undefined] {
  const [tip, setTip] = useState<[CID | undefined, CID[]]>();

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCoTip(coId).then((init) => {
      if (!cancelled) setTip(init);
    });

    void listenCoState(([eventCoId, state, heads]) => {
      if (coId === eventCoId) setTip([state, heads]);
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [coId]);

  return tip ?? [undefined, undefined];
}

/**
 * Resolve a CID to a typed value, refreshing when `refreshKey` (e.g. heads) changes.
 *
 * @typeParam T - Expected decoded value type
 * @param cid - CID to resolve; `undefined` keeps the prior value; `null` clears it
 * @param session - Open session id; `undefined` keeps the prior value
 * @param refreshKey - Optional CID list used as a refresh dependency (e.g. heads)
 * @returns Decoded value as `T`, or `undefined` while loading / after a `null` cid
 */
export function useResolveCid<T = unknown>(
  cid: CID | undefined | null,
  session: string | undefined,
  refreshKey?: CID[],
): T | undefined {
  const [state, setState] = useState<T | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cid === undefined || session === undefined) return;
      if (cid === null) {
        if (!cancelled) setState(undefined);
        return;
      }
      const value = (await resolveCid(session, cid)) as T;
      if (!cancelled) setState(value);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [cid, session, headsKey(refreshKey)]);

  return state;
}

/**
 * Subscribe to a CO and resolve its tip to decoded root data.
 * Prefer {@link useCoTip} when you only need tip CIDs / heads.
 *
 * @typeParam T - Expected decoded CO root type
 * @param coId - CO id to follow
 * @returns Decoded CO root, or `undefined` while loading
 */
export function useCo<T = unknown>(coId: string): T | undefined {
  const { sessionId } = useCoSession(coId);
  const [tipCid, heads] = useCoTip(coId);
  return useResolveCid<T>(tipCid, sessionId, heads);
}
