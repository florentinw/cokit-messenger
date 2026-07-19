import { useEffect, useState } from "react";
import { CID } from "multiformats";
import { resolveCid } from "@/lib/co-sdk/co/invoke";
import { useCoSession, useCoTip, useResolveCid } from "@/lib/co-sdk/co/hooks";

function headsKey(heads: CID[] | undefined): string {
  return heads?.map((h) => h.toString()).join("\0") ?? "";
}

/**
 * Resolve the tip CID of a named core inside a CO.
 * Re-runs when `coCid` or `coHeads` change (drive those from {@link useCoTip}).
 *
 * Clearer local name for the upstream SDK’s `useCoCore`.
 *
 * @param coCid - Tip CID of the parent CO; `undefined` while still loading
 * @param coreId - Core name inside the CO (e.g. `"membership"`, `"room"`)
 * @param session - Open session id; `undefined` while still loading
 * @param coHeads - Optional heads used as a refresh key when the tip changes
 * @returns Core tip CID; `undefined` while loading; `null` when the core is absent
 */
export function useCoreTip(
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
        return;
      }
      const resolved = (await resolveCid(session, coCid)) as {
        c?: Record<string, { state?: CID }>;
      };
      if (cancelled) return;
      const nextCore = resolved?.c?.[coreId]?.state;
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
 * Subscribe to a named core inside a CO and resolve its tip to decoded data.
 * Prefer {@link useCoreTip} when you only need the core tip CID.
 *
 * @typeParam T - Expected decoded core value type
 * @param coId - CO id that hosts the core
 * @param coreId - Core name (e.g. `"membership"`, `"room"`)
 * @returns Decoded core data; `undefined` while loading; `null` when the core is absent
 */
export function useCore<T = unknown>(
  coId: string,
  coreId: string,
): T | undefined | null {
  const { sessionId } = useCoSession(coId);
  const [tipCid, heads] = useCoTip(coId);
  const coreTip = useCoreTip(tipCid, coreId, sessionId, heads);
  const data = useResolveCid<T>(coreTip, sessionId, heads);
  if (coreTip === null) return null;
  return data;
}
