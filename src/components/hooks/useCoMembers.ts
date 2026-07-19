import { useEffect, useState } from "react";
import {
  activeDidsFromLocalMembership,
  collectCoMembers,
  localMembershipStateFor,
} from "../../lib/messenger";
import {
  getSharedCoSession,
  listenCoState,
  LocalMembershipState,
  type LocalMembership,
} from "../../lib/co-sdk-extras";

/** Load CoMembers (active + pending) for the selected group CO. */
export function useCoMembers(
  selectedId: string | undefined,
  identity: string | undefined,
  selectedMembership: LocalMembership | undefined,
  detailsOpen: boolean,
) {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedPendingInvites, setSelectedPendingInvites] = useState<string[]>([]);
  const [coMembersRevision, setCoMembersRevision] = useState(0);

  const localMemberFallback = selectedMembership
    ? activeDidsFromLocalMembership(selectedMembership)
    : [];

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listenCoState(([coId]) => {
      if (coId === selectedId) setCoMembersRevision((n) => n + 1);
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
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCoMembers() {
      if (!selectedId || !identity) {
        setSelectedMembers([]);
        setSelectedPendingInvites([]);
        return;
      }

      const state = selectedMembership
        ? localMembershipStateFor(selectedMembership, identity)
        : undefined;
      if (state !== LocalMembershipState.Active) {
        setSelectedMembers(localMemberFallback);
        setSelectedPendingInvites([]);
        return;
      }

      try {
        const session = await getSharedCoSession(selectedId);
        if (cancelled) return;
        const { active, pending } = await collectCoMembers(session, selectedId);
        if (cancelled) return;
        setSelectedMembers(active.length > 0 ? active : localMemberFallback);
        setSelectedPendingInvites(pending);
      } catch {
        if (!cancelled) {
          setSelectedMembers(localMemberFallback);
          setSelectedPendingInvites([]);
        }
      }
    }

    void loadCoMembers();
    return () => {
      cancelled = true;
    };
  }, [selectedId, identity, selectedMembership, detailsOpen, coMembersRevision]);

  return {
    selectedMembers,
    selectedPendingInvites,
    bumpRoster: () => setCoMembersRevision((n) => n + 1),
  };
}
