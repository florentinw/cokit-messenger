import { useEffect, useState } from "react";
import {
  activeParticipants,
  collectActiveParticipantsFromGroup,
  collectPendingInviteesFromGroup,
  membershipStateFor,
} from "../../lib/messenger";
import {
  getSharedCoSession,
  listenCoSdkState,
  MembershipState,
  type Membership,
} from "../../lib/co-sdk-extras";

/** Load active participants + pending invites for the open group details pane. */
export function useGroupRoster(
  selectedId: string | undefined,
  identity: string | undefined,
  selectedMembership: Membership | undefined,
  detailsOpen: boolean,
) {
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedPendingInvites, setSelectedPendingInvites] = useState<string[]>([]);
  const [groupRosterRevision, setGroupRosterRevision] = useState(0);

  const localParticipantFallback = selectedMembership
    ? activeParticipants(selectedMembership)
    : identity
      ? [identity]
      : [];

  // Only listen while details are open — avoids work for chat/invite panes.
  useEffect(() => {
    if (!detailsOpen || !selectedId) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenCoSdkState(([coId]) => {
      if (coId === selectedId) setGroupRosterRevision((n) => n + 1);
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
  }, [selectedId, detailsOpen]);

  useEffect(() => {
    let cancelled = false;
    async function loadGroupRoster() {
      if (!detailsOpen || !selectedId || !identity) {
        setSelectedParticipants([]);
        setSelectedPendingInvites([]);
        return;
      }
      const state = selectedMembership
        ? membershipStateFor(selectedMembership, identity)
        : undefined;
      if (state !== MembershipState.Active) {
        setSelectedParticipants(localParticipantFallback);
        setSelectedPendingInvites([]);
        return;
      }
      try {
        const session = await getSharedCoSession(selectedId);
        const [active, pending] = await Promise.all([
          collectActiveParticipantsFromGroup(session, selectedId),
          collectPendingInviteesFromGroup(session, selectedId),
        ]);
        if (cancelled) return;
        setSelectedParticipants(active.length > 0 ? active : localParticipantFallback);
        setSelectedPendingInvites(pending);
      } catch {
        if (!cancelled) {
          setSelectedParticipants(localParticipantFallback);
          setSelectedPendingInvites([]);
        }
      }
    }
    void loadGroupRoster();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, identity, selectedMembership, detailsOpen, groupRosterRevision]);

  return {
    selectedParticipants,
    selectedPendingInvites,
    bumpRoster: () => setGroupRosterRevision((n) => n + 1),
  };
}
