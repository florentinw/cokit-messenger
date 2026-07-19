import type { CID } from "multiformats";
import { resolveCid } from "./invoke";

/** In-flight / completed resolves keyed by session + action-cid list. */
const cache = new Map<string, Promise<unknown[]>>();

function cacheKey(session: string, cids: CID[]): string {
  return `${session}\0${cids.map((c) => c.toString()).join("\0")}`;
}

/**
 * Resolve reducer action CIDs in parallel, optionally sharing results across remounts.
 */
export function resolveActionsParallel(
  session: string,
  cids: CID[],
  options?: { cache?: boolean },
): Promise<unknown[]> {
  if (cids.length === 0) return Promise.resolve([]);

  const useCache = options?.cache !== false;
  const key = cacheKey(session, cids);

  if (useCache) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  const pending = Promise.all(
    cids.map(async (cid) => {
      try {
        return await resolveCid(session, cid);
      } catch (err) {
        console.error("Failed to resolve action", err);
        return undefined;
      }
    }),
  ).then((items) => items.filter((item): item is unknown => item !== undefined));

  if (useCache) {
    cache.set(key, pending);
    // Drop failed loads so a later open can retry.
    pending.catch(() => {
      cache.delete(key);
    });
  }

  return pending;
}

/** Clear cached membership/room action resolves (e.g. after leave-all / data reset). */
export function clearResolvedActionsCache(): void {
  cache.clear();
}
