import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  acceptInvite,
  chatStore,
  createGroupChat,
  declineInvite,
  inviteCoMember,
  joinLocalMembership,
  leaveLocalMembership,
  markChatRead,
  removeCoMember,
  renameGroupChat,
  revokeCoMemberInvite,
  setGroupAvatarColor,
  type GroupAvatarColor,
} from "../../lib/messenger";
import {
  invalidateSharedCoSession,
  LocalMembershipState,
  type LocalMembership,
} from "../../lib/co-sdk-extras";
import type { Pane } from "../pane";

type Nav = {
  openChat: (id: string) => void;
  openEmpty: () => void;
  setPane: Dispatch<SetStateAction<Pane>>;
};

type Params = {
  identity: string | undefined;
  localSession: string | undefined;
  focusedId: string | undefined;
  setMemberships: Dispatch<SetStateAction<LocalMembership[]>>;
  setCreateError: Dispatch<SetStateAction<string | undefined>>;
  setInviteError: Dispatch<SetStateAction<string | undefined>>;
  createSidebarBaselineRef: MutableRefObject<Set<string> | null>;
  membershipIdsRef: MutableRefObject<Set<string>>;
  bumpRoster: () => void;
  nav: Nav;
};

export function useChatMutations({
  identity,
  localSession,
  focusedId,
  setMemberships,
  setCreateError,
  setInviteError,
  createSidebarBaselineRef,
  membershipIdsRef,
  bumpRoster,
  nav,
}: Params) {
  const onCreate = useCallback(
    async (name: string, avatarColor: GroupAvatarColor, inviteeDids: string[] = []) => {
      if (!identity) {
        setCreateError("Identity is not ready yet. Wait a moment and try again.");
        return;
      }
      if (!localSession) {
        setCreateError("Local session is not ready yet. Wait a moment and try again.");
        return;
      }
      // Hide the in-flight membership until create finishes — draft stays the only row.
      if (!createSidebarBaselineRef.current) {
        createSidebarBaselineRef.current = new Set(membershipIdsRef.current);
      }
      setCreateError(undefined);
      try {
        const coId = await createGroupChat(identity, name, avatarColor);
        await joinLocalMembership(localSession, identity, coId);
        const inviteErrors: string[] = [];
        for (const inviteeDid of inviteeDids) {
          try {
            await inviteCoMember(identity, coId, inviteeDid);
          } catch (err) {
            console.error(err);
            inviteErrors.push(err instanceof Error ? err.message : String(err));
          }
        }
        const now = Date.now();
        setMemberships((prev) => {
          if (prev.some((m) => m.id === coId)) return prev;
          return [
            ...prev,
            {
              id: coId,
              did: { [identity]: LocalMembershipState.Active },
              state: [],
              tags: [],
            },
          ];
        });
        markChatRead(coId, now);
        chatStore.applyLocal(coId, {
          name,
          color: avatarColor,
          unread: 0,
          timestamp: now,
        });
        createSidebarBaselineRef.current = null;
        nav.openChat(coId);
        if (inviteErrors.length > 0) {
          console.warn("Some create-time invites failed:", inviteErrors);
        }
      } catch (err) {
        console.error(err);
        setCreateError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [
      identity,
      localSession,
      createSidebarBaselineRef,
      membershipIdsRef,
      setCreateError,
      setMemberships,
      nav,
    ],
  );

  const onLeave = useCallback(async () => {
    if (!identity || !localSession || !focusedId) return;
    const leavingId = focusedId;
    await leaveLocalMembership(localSession, identity, leavingId);
    setMemberships((prev) => prev.filter((m) => m.id !== leavingId));
    chatStore.remove(leavingId);
    invalidateSharedCoSession(leavingId);
    nav.openEmpty();
  }, [identity, localSession, focusedId, setMemberships, nav]);

  const onRemoveCoMember = useCallback(
    async (memberDid: string) => {
      if (!identity || !localSession || !focusedId) return;
      await removeCoMember(identity, focusedId, memberDid);
      bumpRoster();
    },
    [identity, localSession, focusedId, bumpRoster],
  );

  const onRevokeInvite = useCallback(
    async (inviteeDid: string) => {
      if (!identity || !focusedId) return;
      await revokeCoMemberInvite(identity, focusedId, inviteeDid);
      bumpRoster();
    },
    [identity, focusedId, bumpRoster],
  );

  const onInvite = useCallback(
    async (inviteeDid: string) => {
      if (!identity || !localSession || !focusedId) {
        throw new Error("Identity or session is not ready yet. Wait a moment and try again.");
      }
      await inviteCoMember(identity, focusedId, inviteeDid);
      bumpRoster();
    },
    [identity, localSession, focusedId, bumpRoster],
  );

  const onMessagesSeen = useCallback(
    (latestTimestamp: number) => {
      if (!focusedId) return;
      markChatRead(focusedId, latestTimestamp);
      chatStore.applyLocal(focusedId, { unread: 0 });
    },
    [focusedId],
  );

  const onSaveGroupDetails = useCallback(
    async (draft: { name: string; avatarColor: GroupAvatarColor }) => {
      if (!identity || !focusedId) {
        throw new Error("Identity or session is not ready yet. Wait a moment and try again.");
      }
      const name = draft.name.trim();
      chatStore.applyLocal(focusedId, { name, color: draft.avatarColor });
      await renameGroupChat(identity, focusedId, name);
      await setGroupAvatarColor(identity, focusedId, draft.avatarColor);
    },
    [identity, focusedId],
  );

  const onAcceptInvite = useCallback(
    async (coId: string) => {
      if (!identity || !localSession) {
        setInviteError("Identity or session is not ready yet. Wait a moment and try again.");
        return;
      }
      setInviteError(undefined);
      try {
        await acceptInvite(localSession, identity, coId);
        invalidateSharedCoSession(coId);
        setMemberships((prev) =>
          prev.map((m) =>
            m.id === coId
              ? { ...m, did: { ...m.did, [identity]: LocalMembershipState.Join } }
              : m,
          ),
        );
        nav.openChat(coId);
      } catch (err) {
        console.error(err);
        setInviteError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [identity, localSession, setInviteError, setMemberships, nav],
  );

  const onDeclineInvite = useCallback(
    async (coId: string) => {
      if (!identity || !localSession) {
        setInviteError("Identity or session is not ready yet. Wait a moment and try again.");
        return;
      }
      setInviteError(undefined);
      try {
        await declineInvite(localSession, identity, coId);
        setMemberships((prev) => prev.filter((m) => m.id !== coId));
        if (focusedId === coId) nav.openEmpty();
      } catch (err) {
        console.error(err);
        setInviteError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [identity, localSession, focusedId, setInviteError, setMemberships, nav],
  );

  return {
    onCreate,
    onLeave,
    onRemoveCoMember,
    onRevokeInvite,
    onInvite,
    onMessagesSeen,
    onSaveGroupDetails,
    onAcceptInvite,
    onDeclineInvite,
  };
}
