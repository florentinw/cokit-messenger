import { useEffect, useMemo, useState } from "react";
import {
  collectMembershipList,
  isSidebarMembership,
  membershipStateFor,
} from "../../lib/messenger";
import { MembershipState, type Membership, type Memberships } from "../../lib/co-sdk";

/** Load and stabilize the local membership list for the sidebar. */
export function useMemberships(
  localSession: string | undefined,
  membershipsState: Memberships | undefined,
  identity: string | undefined,
) {
  const [memberships, setMemberships] = useState<Membership[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadMemberships() {
      if (!localSession) return;
      // While membership state is refetching, keep the previous list to avoid
      // emptying the sidebar and clearing the selected chat.
      if (membershipsState === undefined) return;
      const raw = membershipsState?.memberships ?? membershipsState;
      const list = await collectMembershipList(localSession, raw);
      if (cancelled) return;
      const next = list.filter((m) => m.id && m.id !== "local");
      setMemberships((prev) => {
        // Transient empty resolves during CO updates — keep showing the sidebar.
        if (next.length === 0 && prev.length > 0) return prev;
        return next;
      });
    }
    void loadMemberships();
    return () => {
      cancelled = true;
    };
  }, [localSession, membershipsState]);

  const sidebarMemberships = useMemo(
    () => memberships.filter((m) => isSidebarMembership(m, identity)),
    [memberships, identity],
  );

  const activeCoIds = useMemo(
    () =>
      sidebarMemberships
        .filter((m) => membershipStateFor(m, identity) === MembershipState.Active)
        .map((m) => m.id),
    [sidebarMemberships, identity],
  );

  return { memberships, setMemberships, sidebarMemberships, activeCoIds };
}
