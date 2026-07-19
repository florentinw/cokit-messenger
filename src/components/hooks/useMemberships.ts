import { useEffect, useMemo, useState } from "react";
import {
  collectLocalMemberships,
  isSidebarMembership,
  localMembershipStateFor,
} from "@/lib/messenger";
import {
  LocalMembershipState,
  type LocalMembership,
  type LocalMemberships,
} from "@/lib/co-sdk/identity";

/** Load and stabilize the LocalMembership list for the sidebar. */
export function useMemberships(
  localSession: string | undefined,
  membershipsState: LocalMemberships | undefined | null,
  identity: string | undefined,
) {
  const [memberships, setMemberships] = useState<LocalMembership[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadMemberships() {
      if (!localSession) return;
      // While membership state is refetching, keep the previous list to avoid
      // emptying the sidebar and clearing the selected chat.
      if (membershipsState == null) return;
      const raw = membershipsState?.memberships ?? membershipsState;
      const list = await collectLocalMemberships(localSession, raw);
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
        .filter((m) => localMembershipStateFor(m, identity) === LocalMembershipState.Active)
        .map((m) => m.id),
    [sidebarMemberships, identity],
  );

  return { memberships, setMemberships, sidebarMemberships, activeCoIds };
}
