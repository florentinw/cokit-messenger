import { useEffect, useState } from "react";
import { CID } from "multiformats";
import { DagList } from "./dag-list";
import {
  createIdentity,
  getActions,
  getCoState,
  resolveCid,
  sessionClose,
  sessionOpen,
} from "./invoke";
import { listenCoSdkState } from "./state-listener";
import type { GetActionsResponse, KeystoreKey } from "./types";

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
    let sessionId: string | undefined;
    setSession(undefined);
    setSessionError(undefined);

    void sessionOpen(co)
      .then((opened) => {
        if (cancelled) {
          void sessionClose(opened).catch(() => {});
          return;
        }
        sessionId = opened;
        setSession(opened);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSessionError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
      if (sessionId !== undefined) {
        void sessionClose(sessionId).catch(() => {});
      }
    };
  }, [co]);

  return { sessionId: session, error: sessionError };
}

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
      if (session === undefined || coCid === undefined) return;
      const resolved = (await resolveCid(session, coCid)) as {
        c?: Record<string, { state?: CID }>;
      };
      const coreCid = resolved?.c?.[coreId]?.state;
      if (!cancelled) setCoreState(coreCid ?? null);
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
      if (cid == null || session === undefined) return;
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
    keyStoreKeys.a,
    sessionId,
  );
  const existing = await dagList.find((item) => item[1].v?.name === name);
  return existing?.[0];
}

export function useDidKeyIdentity(
  name: string,
  sessionId: string | undefined,
): string | undefined {
  const [identity, setIdentity] = useState<string | undefined>();
  // Re-run when local CO state updates — keystore may not exist on first paint.
  const [localStateCid] = useCo("local");

  useEffect(() => {
    if (sessionId === undefined || identity !== undefined) return;

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
          return;
        }

        const did = await createIdentity(name);
        if (!cancelled) setIdentity(did);
      } catch (err) {
        console.error("Failed to load identity", err);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [name, sessionId, localStateCid, identity]);

  return identity;
}

export function useCoActions(
  heads: CID[] | undefined,
  session: string | undefined,
  count = 100,
): GetActionsResponse | undefined {
  const [actions, setActions] = useState<GetActionsResponse>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (heads === undefined || session === undefined) return;
      const result = await getActions(session, heads, count, undefined);
      if (!cancelled) setActions(result);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [heads, session, count]);

  return actions;
}
