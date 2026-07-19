import { useEffect, useRef, useState } from "react";
import { CID } from "multiformats";
import { DagList } from "./dag-list";
import { CoOperationError, formatCoError } from "./errors";
import {
  createIdentity,
  getCoState,
  resolveCid,
} from "./invoke";
import { listenCoSdkState } from "./state-listener";
import { getSharedCoSession } from "./session-cache";
import type { KeystoreKey } from "./types";

function headsKey(heads: CID[] | undefined): string {
  return heads?.map((h) => h.toString()).join("\0") ?? "";
}

/**
 * Open (or reuse) a shared session for `co`.
 * Keeps the previous session id while re-opening to avoid loading flashes.
 *
 * @param co - CO document id to open a session for
 * @returns `{ sessionId, error }` — `sessionId` when open; `error` if open failed
 */
export function useCoSession(co: string): {
  sessionId: string | undefined;
  error: Error | undefined;
} {
  const [session, setSession] = useState<string | undefined>();
  const [sessionError, setSessionError] = useState<Error | undefined>();

  useEffect(() => {
    let cancelled = false;

    void getSharedCoSession(co)
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
  }, [co]);

  return { sessionId: session, error: sessionError };
}

/**
 * Subscribe to tip CID + heads for a CO document (stale-while-revalidate).
 *
 * @param co - CO document id to follow
 * @returns `[stateCid, heads]`, or `[undefined, undefined]` before the first load
 */
export function useCo(co: string): [CID | undefined, CID[] | undefined] {
  const [coState, setCoState] = useState<[CID | undefined, CID[]]>();

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCoState(co).then((init) => {
      if (!cancelled) setCoState(init);
    });

    void listenCoSdkState(([coId, state, heads]) => {
      if (co === coId) setCoState([state, heads]);
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
  }, [co]);

  return coState ?? [undefined, undefined];
}

/**
 * Resolve the tip CID of a named core inside a CO document.
 * Re-runs when `coCid` or `coHeads` change (drive those from {@link useCo}).
 *
 * Clearer local name for the upstream SDK’s `useCoCore`.
 *
 * @param coCid - Tip CID of the parent CO document; `undefined` while still loading
 * @param coreId - Core name inside the CO (e.g. `"membership"`, `"room"`)
 * @param session - Open session id; `undefined` while still loading
 * @param coHeads - Optional heads used as a refresh key when the tip changes
 * @returns Core tip CID; `undefined` while loading; `null` when the core is absent
 */
export function useCoreTipCid(
  coCid: CID | undefined,
  coreId: string,
  session: string | undefined,
  coHeads?: CID[],
): CID | undefined | null {
  const [coreState, setCoreState] = useState<CID | undefined | null>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (session === undefined || coCid === undefined) {
        // Still loading session/CO — keep the previous core cid (stale-while-revalidate).
        return;
      }
      const resolved = (await resolveCid(session, coCid)) as {
        c?: Record<string, { state?: CID }>;
      };
      if (cancelled) return;
      const nextCore = resolved?.c?.[coreId]?.state;
      // Always adopt the core for this CO document. Keeping a previous core CID
      // across local updates permanently hides new memberships (e.g. DidComm invites).
      setCoreState(nextCore !== undefined ? nextCore : null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [coCid, coreId, session, headsKey(coHeads)]);

  return coreState;
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

async function findNamedKeystoreDid(
  sessionId: string,
  name: string,
): Promise<string | undefined> {
  const [stateCid] = await getCoState("local");
  if (stateCid == null) return undefined;

  const coState = (await resolveCid(sessionId, stateCid)) as {
    c?: Record<string, { state?: CID }>;
  };
  const keystoreCid = coState?.c?.keystore?.state;
  if (keystoreCid == null) return undefined;

  const keystoreState = (await resolveCid(sessionId, keystoreCid)) as {
    keys?: CID;
  };
  if (keystoreState?.keys == null) return undefined;

  const keyStoreKeys = (await resolveCid(sessionId, keystoreState.keys)) as {
    a?: { n?: CID[]; l?: [string, { v?: KeystoreKey }][] };
  };
  if (keyStoreKeys?.a === undefined) return undefined;

  const dagList = new DagList<[string, { v?: KeystoreKey }]>(
    { n: keyStoreKeys.a.n, l: keyStoreKeys.a.l },
    sessionId,
  );
  const existing = await dagList.find((item) => item[1].v?.name === name);
  return existing?.[0];
}

/**
 * Load or create a named did:key identity from the local CO keystore.
 * Re-runs when local CO state updates so a missing keystore can appear later.
 *
 * @param name - Keystore entry name to find or create
 * @param sessionId - Open session on the local CO; hook is idle when `undefined`
 * @returns `{ identity?, error? }` — did:key when ready; `error` if load/create failed
 */
export function useDidKeyIdentity(
  name: string,
  sessionId: string | undefined,
): { identity?: string; error?: Error } {
  const [identity, setIdentity] = useState<string | undefined>();
  const [identityError, setIdentityError] = useState<Error | undefined>();
  const identityRef = useRef<string | undefined>(undefined);
  identityRef.current = identity;
  const [localStateCid] = useCo("local");

  useEffect(() => {
    if (sessionId === undefined) return;

    const session = sessionId;
    let cancelled = false;

    async function load() {
      try {
        const [stateCid] = await getCoState("local");
        if (stateCid == null) return;

        const existing = await findNamedKeystoreDid(session, name);
        if (cancelled) return;
        if (existing !== undefined) {
          setIdentity(existing);
          setIdentityError(undefined);
          return;
        }

        // Keystore can be briefly unreadable while local CO is rewriting.
        // Never create a second identity or clear the one we already have.
        if (identityRef.current !== undefined) return;

        const did = await createIdentity(name);
        if (!cancelled) {
          setIdentity(did);
          setIdentityError(undefined);
        }
      } catch (err) {
        console.error("Failed to load identity", err);
        if (cancelled) return;
        if (identityRef.current !== undefined) return;
        setIdentityError(new CoOperationError(formatCoError(err)));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [name, sessionId, localStateCid]);

  return { identity, error: identityError };
}
