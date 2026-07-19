import {
  type CID,
  listenCoState,
} from "@/lib/co-sdk/co";
import { useEffect, type MutableRefObject, type RefObject } from "react";
import {
  chatStore,
  displayName,
  inviteDisplayMetaFromLocalMembership,
  localMembershipStateFor,
  refreshChatFromCo,
  refreshChatsFromCo,
} from "@/lib/messenger";
import { LocalMembershipState, type LocalMembership } from "@/lib/co-sdk/identity";

/** Hydrate ChatStore for sidebar LocalMemberships (invites + active chats). */
export function useChatHydration(
  localSession: string | undefined,
  sidebarMemberships: LocalMembership[],
  identity: string | undefined,
  selectedIdRef: RefObject<string | undefined>,
) {
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!localSession || sidebarMemberships.length === 0) return;

      const pending: LocalMembership[] = [];
      const active: string[] = [];
      for (const m of sidebarMemberships) {
        const state = localMembershipStateFor(m, identity);
        if (
          state === LocalMembershipState.Invite ||
          state === LocalMembershipState.Join ||
          state === LocalMembershipState.Pending
        ) {
          pending.push(m);
        } else {
          active.push(m.id);
        }
      }

      for (const m of pending) {
        if (cancelled) return;
        const inviteMeta = await inviteDisplayMetaFromLocalMembership(localSession, m);
        if (cancelled) return;
        const inviterLabel =
          inviteMeta.inviterName ||
          (inviteMeta.inviterDid ? displayName(inviteMeta.inviterDid) : undefined);
        chatStore.applyLocal(m.id, {
          ...(inviteMeta.inviterDid ? { inviterDid: inviteMeta.inviterDid } : {}),
          ...(inviterLabel ? { inviterName: inviterLabel } : {}),
          unread: 0,
        });
      }

      if (cancelled || active.length === 0) return;
      await refreshChatsFromCo(active, identity, {
        selectedId: selectedIdRef.current,
      });
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [sidebarMemberships, identity, localSession, selectedIdRef]);
}

/**
 * Stable app-lifetime multiplexer — refs hold active ids / selection / identity.
 * Debounces CO tip events into `refreshChatFromCo`.
 */
export function useChatStateMultiplexer(
  activeIdsRef: MutableRefObject<Set<string>>,
  selectedIdRef: RefObject<string | undefined>,
  identityRef: RefObject<string | undefined>,
) {
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const pending = new Map<string, { stateCid?: CID; heads?: CID[] }>();

    async function flush() {
      timer = undefined;
      const batch = [...pending.entries()];
      pending.clear();
      const identityNow = identityRef.current;
      const selected = selectedIdRef.current;
      await Promise.all(
        batch.map(([coId, tip]) => {
          if (!activeIdsRef.current.has(coId)) return Promise.resolve();
          return refreshChatFromCo(coId, identityNow, {
            selected: selected === coId,
            includeActions: selected === coId,
            stateCid: tip.stateCid,
            heads: tip.heads,
          });
        }),
      );
    }

    function schedule(coId: string, tip?: { stateCid?: CID; heads?: CID[] }) {
      const prev = pending.get(coId);
      pending.set(coId, {
        stateCid: tip?.stateCid ?? prev?.stateCid,
        heads: tip?.heads ?? prev?.heads,
      });
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void flush(), 80);
    }

    let unlisten: (() => void) | undefined;
    void listenCoState(([coId, stateCid, heads]) => {
      if (coId === "local") return;
      if (!activeIdsRef.current.has(coId)) return;
      schedule(coId, { stateCid, heads });
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      unlisten?.();
    };
  }, [activeIdsRef, selectedIdRef, identityRef]);
}
