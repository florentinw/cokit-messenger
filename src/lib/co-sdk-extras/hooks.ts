import { useEffect, useRef, useState } from "react";
import { CID } from "multiformats";
import { asDagNode, DagList } from "./dag-list";
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

/** Bump when `co-sdk-new-state` fires for a CO — refreshes nested core/cid hooks. */
export function useCoStateRevision(co: string | undefined): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (co === undefined) return;
    let unlisten: (() => void) | undefined;
    void listenCoSdkState(([coId]) => {
      if (co === coId) setRevision((value) => value + 1);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [co]);

  return revision;
}

export function useCoSession(co: string): {
  sessionId: string | undefined;
  error: Error | undefined;
} {
  const [session, setSession] = useState<string | undefined>();
  const [sessionError, setSessionError] = useState<Error | undefined>();

  useEffect(() => {
    let cancelled = false;
    // Keep the previous session id while re-opening — clearing it flashes the
    // whole app back through the identity loading screen.

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

export function useCo(co: string): [CID | undefined, CID[] | undefined] {
  const [coState, setCoState] = useState<[CID | undefined, CID[]]>();

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    // Stale-while-revalidate: don't clear heads/state on resubscribe.

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

export function useCoCore(
  coCid: CID | undefined,
  coreId: string,
  session: string | undefined,
  watchCo?: string,
  coHeads?: CID[],
): CID | undefined | null {
  const [coreState, setCoreState] = useState<CID | undefined | null>(undefined);
  const revision = useCoStateRevision(watchCo);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (session === undefined || coCid === undefined) {
        // Still loading session/CO — keep the previous core cid (stale-while-revalidate).
        return;
      }
      const readCore = async () => {
        const resolved = (await resolveCid(session, coCid)) as {
          c?: Record<string, { state?: CID }>;
        };
        return resolved?.c?.[coreId]?.state;
      };
      let nextCore = await readCore();
      // Mid-update resolves can omit cores; retry once before committing.
      if (nextCore === undefined) {
        await new Promise((r) => setTimeout(r, 32));
        if (cancelled) return;
        nextCore = await readCore();
      }
      if (cancelled) return;
      // Always adopt the core for this CO document. Keeping a previous core CID
      // across local updates permanently hides new memberships (e.g. DidComm invites).
      setCoreState(nextCore !== undefined ? nextCore : null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [coCid, coreId, session, headsKey(coHeads), revision]);

  return coreState;
}

export function useResolveCid<T = unknown>(
  cid: CID | undefined | null,
  session: string | undefined,
  watchCo?: string,
  refreshKey?: CID[],
): T | undefined {
  const [state, setState] = useState<T | undefined>();
  const revision = useCoStateRevision(watchCo);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // `undefined` cid/session: still loading — keep prior value.
      if (cid === undefined || session === undefined) return;
      // `null` means the core is absent on this CO document — clear so callers
      // can SWR their own list, and so we don't keep a stale resolve forever.
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
  }, [cid, session, headsKey(refreshKey), revision]);

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
    asDagNode(keyStoreKeys.a),
    sessionId,
  );
  const existing = await dagList.find((item) => item[1].v?.name === name);
  return existing?.[0];
}

export function useDidKeyIdentity(
  name: string,
  sessionId: string | undefined,
): { identity?: string; error?: Error } {
  const [identity, setIdentity] = useState<string | undefined>();
  const [identityError, setIdentityError] = useState<Error | undefined>();
  const identityRef = useRef<string | undefined>(undefined);
  identityRef.current = identity;
  // Re-run when local CO state updates — keystore may not exist on first paint.
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
