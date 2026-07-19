import { useEffect, useRef, useState } from "react";
import { CID } from "multiformats";
import {
  CoOperationError,
  getCoTip,
  resolveCid,
  useCoTip,
} from "@/lib/co-sdk/co";
import { DagList } from "@/lib/co-sdk/core";
import { createIdentity } from "./create-identity";
import type { KeystoreKey } from "./types";

async function findNamedKeystoreDid(
  sessionId: string,
  name: string,
): Promise<string | undefined> {
  const [stateCid] = await getCoTip("local");
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
 * Re-runs when local CO tip updates so a missing keystore can appear later.
 *
 * @param name - Keystore entry name to find or create
 * @param sessionId - Open session on the local CO; hook is idle when `undefined`
 * @returns `{ identity?, error? }` — did:key when ready; `error` if load/create failed
 */
export function useIdentity(
  name: string,
  sessionId: string | undefined,
): { identity?: string; error?: CoOperationError } {
  const [identity, setIdentity] = useState<string | undefined>();
  const [identityError, setIdentityError] = useState<CoOperationError | undefined>();
  const identityRef = useRef<string | undefined>(undefined);
  identityRef.current = identity;
  const [localTipCid] = useCoTip("local");

  useEffect(() => {
    if (sessionId === undefined) return;

    const session = sessionId;
    let cancelled = false;

    async function load() {
      try {
        const [stateCid] = await getCoTip("local");
        if (stateCid == null) return;

        const existing = await findNamedKeystoreDid(session, name);
        if (cancelled) return;
        if (existing !== undefined) {
          setIdentity(existing);
          setIdentityError(undefined);
          return;
        }

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
        setIdentityError(CoOperationError.from(err));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [name, sessionId, localTipCid]);

  return { identity, error: identityError };
}
