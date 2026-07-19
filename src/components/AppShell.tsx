import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CID } from "multiformats";
import {
  IDENTITY_NAME,
  acceptInvite,
  activeParticipants,
  chatStore,
  collectActiveParticipantsFromGroup,
  collectMembershipList,
  collectPendingInviteesFromGroup,
  createGroupChat,
  declineInvite,
  DEFAULT_GROUP_AVATAR_COLOR,
  inviteDisplayMetaFromMembership,
  inviteParticipant,
  isSidebarMembership,
  joinMembership,
  leaveMembership,
  markChatRead,
  membershipStateFor,
  publishDisplayNameToGroups,
  readProfileName,
  refreshChatFromCo,
  refreshChatsFromCo,
  removeParticipant,
  renameGroupChat,
  revokeInvite,
  setGroupAvatarColor,
  truncateDid,
  useChatStoreRevision,
  type GroupAvatarColor,
} from "../lib/messenger";
import {
  CO_CORE_NAME_MEMBERSHIP,
  MembershipState,
  RESET_LOCAL_DATA_HINT,
  TAURI_REQUIRED_MESSAGE,
  errorDetail,
  formatCoError,
  getSharedCoSession,
  invalidateSharedCoSession,
  isTauriRuntimeAvailable,
  listenCoSdkState,
  useCo,
  useCoCore,
  useCoSession,
  useDidKeyIdentity,
  useResolveCid,
  type Membership,
  type Memberships,
} from "../lib/co-sdk";
import { ChatPane } from "./chat/ChatPane";
import { ChatSidebar, type ChatListEntry } from "./sidebar/ChatSidebar";
import { Button } from "./global/Button";
import { GroupDetails } from "./chat-details/GroupDetails";
import { Icon } from "./global/icons/Icon";
import { IdentityLoadingScreen } from "./global/IdentityLoadingScreen";
import { InviteAcceptPane } from "./chat/InviteAcceptPane";
import { NewGroupPanel } from "./chat-details/NewGroupPanel";
import { ProfilePanel } from "./global/ProfilePanel";

export function AppShell() {
  const { sessionId: localSession, error: sessionError } = useCoSession("local");
  const { identity, error: identityError } = useDidKeyIdentity(IDENTITY_NAME, localSession);
  const [localCoCid, localHeads] = useCo("local");
  const membershipCoreCid = useCoCore(
    localCoCid,
    CO_CORE_NAME_MEMBERSHIP,
    localSession,
    "local",
    localHeads,
  );
  const membershipsState = useResolveCid<Memberships>(
    membershipCoreCid,
    localSession,
    "local",
    localHeads,
  );

  const [selectedId, setSelectedId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraftName, setCreateDraftName] = useState("");
  const [createDraftColor, setCreateDraftColor] = useState<GroupAvatarColor>(
    DEFAULT_GROUP_AVATAR_COLOR,
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(readProfileName);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [inviteError, setInviteError] = useState<string>();
  const [errorCopied, setErrorCopied] = useState(false);
  const chatStoreRevision = useChatStoreRevision();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedPendingInvites, setSelectedPendingInvites] = useState<string[]>([]);
  const [groupRosterRevision, setGroupRosterRevision] = useState(0);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const activeIdsRef = useRef<Set<string>>(new Set());
  /** Membership ids present when create submit starts — hide newer ones until create finishes. */
  const createSidebarBaselineRef = useRef<Set<string> | null>(null);
  const membershipIdsRef = useRef<Set<string>>(new Set());
  membershipIdsRef.current = new Set(memberships.map((m) => m.id));

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
  activeIdsRef.current = new Set(activeCoIds);

  // Hydrate sidebar meta into ChatStore (not on every selection change).
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!localSession || sidebarMemberships.length === 0) return;

      const pending: typeof sidebarMemberships = [];
      const active: string[] = [];
      for (const m of sidebarMemberships) {
        const state = membershipStateFor(m, identity);
        if (
          state === MembershipState.Invite ||
          state === MembershipState.Join ||
          state === MembershipState.Pending
        ) {
          pending.push(m);
        } else {
          active.push(m.id);
        }
      }

      for (const m of pending) {
        if (cancelled) return;
        const inviteMeta = await inviteDisplayMetaFromMembership(localSession, m);
        if (cancelled) return;
        chatStore.applyLocal(m.id, {
          ...(inviteMeta.name ? { name: inviteMeta.name } : {}),
          ...(inviteMeta.color ? { color: inviteMeta.color } : {}),
          ...(inviteMeta.inviterName ? { inviterName: inviteMeta.inviterName } : {}),
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
  }, [sidebarMemberships, identity, localSession]);

  // Mark the open chat read in the store when selection changes (no full hydrate).
  useEffect(() => {
    if (!selectedId || !identity) return;
    const membership = memberships.find((m) => m.id === selectedId);
    if (!membership) return;
    const state = membershipStateFor(membership, identity);
    if (state !== MembershipState.Active) return;
    chatStore.applyLocal(selectedId, { unread: 0 });
    void refreshChatFromCo(selectedId, identity, {
      selected: true,
      includeActions: true,
    });
  }, [selectedId, identity, memberships]);

  // Stable app-lifetime multiplexer — refs hold active ids / selection / identity.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const pending = new Map<string, { stateCid?: CID; heads?: CID[] }>();
    let revalidateTimer: number | undefined;

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
    void listenCoSdkState(([coId, stateCid, heads]) => {
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

    // Occasional revalidate so missed events still heal without a full refresh.
    revalidateTimer = window.setInterval(() => {
      for (const coId of activeIdsRef.current) schedule(coId);
    }, 12_000);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      if (revalidateTimer !== undefined) window.clearInterval(revalidateTimer);
      unlisten?.();
    };
  }, []);

  const chats: ChatListEntry[] = useMemo(
    () => {
      const baseline = createSidebarBaselineRef.current;
      // While the create panel is open after submit, keep the draft as the only
      // new row — membership updates can land before create finishes.
      const source =
        createOpen && baseline
          ? sidebarMemberships.filter((m) => baseline.has(m.id))
          : sidebarMemberships;
      return source.map((m) => {
        const state = membershipStateFor(m, identity);
        const invited = state === MembershipState.Invite;
        const joining =
          state === MembershipState.Join || state === MembershipState.Pending;
        const meta = chatStore.get(m.id);
        const resolvedName =
          meta?.name && meta.name !== "Group chat" && meta.name !== m.id
            ? meta.name
            : undefined;
        return {
          coId: m.id,
          name:
            resolvedName ??
            (invited || joining ? truncateDid(m.id, 22) : (meta?.name ?? "Group chat")),
          preview: invited || joining ? undefined : meta?.preview,
          timestamp: invited || joining ? undefined : meta?.timestamp,
          unread: invited || joining ? 0 : meta?.unread ?? 0,
          invited,
          joining,
          inviterName: invited || joining ? meta?.inviterName : undefined,
        };
      });
    },
    // chatStoreRevision forces recompute when the store emits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sidebarMemberships, identity, chatStoreRevision, createOpen, busy],
  );

  // Selection is only cleared by explicit user actions (leave / decline / deselect).
  // Auto-clearing when a chat is briefly missing from a mid-refresh membership
  // list was dropping the open chat after send/invite.

  const selectedChat = chats.find((c) => c.coId === selectedId);
  const selectedMembership = memberships.find((m) => m.id === selectedId);
  const localParticipantFallback = selectedMembership
    ? activeParticipants(selectedMembership)
    : identity
      ? [identity]
      : [];

  // Refresh group roster when the selected CO’s state changes (join/invite/remove).
  useEffect(() => {
    if (!selectedId) return;
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
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    async function loadGroupRoster() {
      if (!selectedId || !identity) {
        setSelectedParticipants([]);
        setSelectedPendingInvites([]);
        return;
      }
      // Only Active members can open the group CO to read participants.
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
    // localParticipantFallback is derived from selectedMembership/identity — listed via those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, identity, selectedMembership, detailsOpen, groupRosterRevision]);

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
      // Keep the same baseline across retries so a half-created CO stays hidden.
      if (!createSidebarBaselineRef.current) {
        createSidebarBaselineRef.current = new Set(membershipIdsRef.current);
      }
      setBusy(true);
      setCreateError(undefined);
      try {
        const coId = await createGroupChat(identity, name, avatarColor);
        await joinMembership(localSession, identity, coId, { emitSystemEvent: false });
        // Invites need the group CO — send after create + join.
        const inviteErrors: string[] = [];
        for (const inviteeDid of inviteeDids) {
          try {
            await inviteParticipant(localSession, identity, coId, inviteeDid);
          } catch (err) {
            console.error(err);
            inviteErrors.push(
              err instanceof Error ? err.message : String(err),
            );
          }
        }
        const now = Date.now();
        setMemberships((prev) => {
          if (prev.some((m) => m.id === coId)) return prev;
          return [...prev, { id: coId, did: { [identity]: MembershipState.Active } }];
        });
        markChatRead(coId, now);
        chatStore.applyLocal(coId, {
          name,
          color: avatarColor,
          unread: 0,
          timestamp: now,
        });
        createSidebarBaselineRef.current = null;
        setSelectedId(coId);
        setCreateOpen(false);
        if (inviteErrors.length > 0) {
          console.warn("Some create-time invites failed:", inviteErrors);
        }
      } catch (err) {
        console.error(err);
        setCreateError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [identity, localSession],
  );

  const onLeave = useCallback(async () => {
    if (!identity || !localSession || !selectedId) return;
    const leavingId = selectedId;
    await leaveMembership(localSession, identity, leavingId);
    setMemberships((prev) => prev.filter((m) => m.id !== leavingId));
    chatStore.remove(leavingId);
    invalidateSharedCoSession(leavingId);
    setDetailsOpen(false);
    setSelectedId(undefined);
  }, [identity, localSession, selectedId]);

  const onRemoveParticipant = useCallback(
    async (participantDid: string) => {
      if (!identity || !localSession || !selectedId) return;
      await removeParticipant(localSession, identity, selectedId, participantDid);
      setGroupRosterRevision((n) => n + 1);
    },
    [identity, localSession, selectedId],
  );

  const onRevokeInvite = useCallback(
    async (inviteeDid: string) => {
      if (!identity || !selectedId) return;
      await revokeInvite(identity, selectedId, inviteeDid);
      setGroupRosterRevision((n) => n + 1);
    },
    [identity, selectedId],
  );

  const onInvite = useCallback(
    async (inviteeDid: string) => {
      if (!identity || !localSession || !selectedId) {
        throw new Error("Identity or session is not ready yet. Wait a moment and try again.");
      }
      await inviteParticipant(localSession, identity, selectedId, inviteeDid);
      setGroupRosterRevision((n) => n + 1);
    },
    [identity, localSession, selectedId],
  );

  const onMessagesSeen = useCallback(
    (latestTimestamp: number) => {
      if (!selectedId) return;
      markChatRead(selectedId, latestTimestamp);
      chatStore.applyLocal(selectedId, { unread: 0 });
    },
    [selectedId],
  );

  const onSaveGroupDetails = useCallback(
    async (draft: { name: string; avatarColor: GroupAvatarColor }) => {
      if (!identity || !selectedId) {
        throw new Error("Identity or session is not ready yet. Wait a moment and try again.");
      }
      setBusy(true);
      try {
        const name = draft.name.trim();
        // Optimistic first so sidebar/avatars update immediately and win races.
        chatStore.applyLocal(selectedId, { name, color: draft.avatarColor });
        await renameGroupChat(identity, selectedId, name);
        await setGroupAvatarColor(identity, selectedId, draft.avatarColor);
      } finally {
        setBusy(false);
      }
    },
    [identity, selectedId],
  );

  const onAcceptInvite = useCallback(
    async (coId: string) => {
      if (!identity || !localSession) {
        setInviteError("Identity or session is not ready yet. Wait a moment and try again.");
        return;
      }
      setBusy(true);
      setInviteError(undefined);
      try {
        await acceptInvite(localSession, identity, coId);
        // Drop any failed pre-Active open so ChatPane can open after Join → Active.
        invalidateSharedCoSession(coId);
        // Optimistically move Invite → Join so we don't open ChatPane before Active.
        setMemberships((prev) =>
          prev.map((m) =>
            m.id === coId
              ? { ...m, did: { ...m.did, [identity]: MembershipState.Join } }
              : m,
          ),
        );
        setSelectedId(coId);
      } catch (err) {
        console.error(err);
        setInviteError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [identity, localSession],
  );

  const onDeclineInvite = useCallback(
    async (coId: string) => {
      if (!identity || !localSession) {
        setInviteError("Identity or session is not ready yet. Wait a moment and try again.");
        return;
      }
      setBusy(true);
      setInviteError(undefined);
      try {
        await declineInvite(localSession, identity, coId);
        setMemberships((prev) => prev.filter((m) => m.id !== coId));
        if (selectedId === coId) setSelectedId(undefined);
      } catch (err) {
        console.error(err);
        setInviteError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [identity, localSession, selectedId],
  );

  const selectedMembershipState = selectedMembership
    ? membershipStateFor(selectedMembership, identity)
    : undefined;
  const selectedIsInvite = selectedMembershipState === MembershipState.Invite;
  const selectedIsJoining =
    selectedMembershipState === MembershipState.Join ||
    selectedMembershipState === MembershipState.Pending;

  const bootstrappedRef = useRef(false);
  if (localSession && identity) bootstrappedRef.current = true;
  const isBootstrapping =
    !bootstrappedRef.current && (!localSession || (!identity && !identityError));

  if (sessionError || identityError) {
    const notInTauri = !isTauriRuntimeAvailable() && sessionError;
    const errorTitle = notInTauri
      ? "Open the desktop app"
      : identityError && formatCoError(identityError).corruptStorage
        ? "Local CO data needs reset"
        : sessionError
          ? "Could not open local session"
          : "Could not load identity";
    const rawMessage = sessionError
      ? notInTauri
        ? TAURI_REQUIRED_MESSAGE
        : errorDetail(sessionError)
      : errorDetail(identityError);
    const formatted = formatCoError(sessionError ?? identityError);
    const errorMessage = formatted.summary;
    const copyMessage = `${errorTitle}\n\n${rawMessage}${formatted.corruptStorage ? `\n\n${RESET_LOCAL_DATA_HINT}` : ""}`;

    async function copyError() {
      await navigator.clipboard.writeText(copyMessage);
      setErrorCopied(true);
      window.setTimeout(() => setErrorCopied(false), 1500);
    }

    return (
      <div className="layer-ground flex h-full w-full flex-col bg-surface text-foreground">
        <div
          data-tauri-drag-region
          className="h-12 shrink-0"
          aria-hidden="true"
        />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="layer-card max-w-md rounded-xl bg-surface p-6 shadow">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-semibold">{errorTitle}</h1>
              <Button
                variant="icon"
                onPress={() => void copyError()}
                aria-label={errorCopied ? "Copied" : "Copy error"}
              >
                <Icon name={errorCopied ? "check" : "copy"} />
              </Button>
            </div>
            <p className="mt-3 type-body-regular text-muted">{errorMessage}</p>
            {formatted.corruptStorage && (
              <p className="mt-2 rounded-lg layer-inset bg-surface px-3 py-2 font-mono type-body-regular text-muted">
                {RESET_LOCAL_DATA_HINT}
              </p>
            )}
            <details className="mt-3">
              <summary className="type-body-regular text-muted">Technical details</summary>
              <p className="mt-2 max-h-48 overflow-auto type-body-regular text-muted whitespace-pre-wrap break-words">
                {rawMessage}
              </p>
            </details>
            <Button
              variant="bare"
              onPress={() => window.location.reload()}
              className="layer-accent interactive mt-4 flex h-7 items-center justify-center rounded-lg border-0 bg-surface px-3 type-body text-foreground"
            >
              Reload
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isBootstrapping) {
    return (
      <IdentityLoadingScreen
        message={
          localSession ? "Setting up your identity…" : "Starting…"
        }
      />
    );
  }

  return (
    <div className="layer-ground relative flex h-full w-full overflow-hidden">
      <ChatSidebar
        chats={chats}
        selectedId={createOpen || profileOpen ? undefined : selectedId}
        creating={createOpen}
        createDraftName={createDraftName}
        createDraftColor={createDraftColor}
        onSelect={(id) => {
          createSidebarBaselineRef.current = null;
          setCreateOpen(false);
          setProfileOpen(false);
          setDetailsOpen(false);
          setSelectedId(id);
          const meta = chatStore.get(id);
          markChatRead(id, meta?.timestamp ?? Date.now());
          chatStore.applyLocal(id, { unread: 0 });
        }}
        onCreate={() => {
          setCreateError(undefined);
          setProfileOpen(false);
          setDetailsOpen(false);
          setCreateDraftName("");
          setCreateDraftColor(DEFAULT_GROUP_AVATAR_COLOR);
          createSidebarBaselineRef.current = null;
          setCreateOpen(true);
        }}
        onOpenProfile={() => {
          createSidebarBaselineRef.current = null;
          setCreateOpen(false);
          setDetailsOpen(false);
          setProfileOpen(true);
        }}
        identity={identity}
        profileName={profileName}
      />

      {profileOpen ? (
        <ProfilePanel
          identity={identity}
          onClose={() => setProfileOpen(false)}
          onSaved={(name) => {
            setProfileName(name);
            if (identity && activeCoIds.length > 0) {
              void publishDisplayNameToGroups(identity, name, activeCoIds);
            }
          }}
        />
      ) : createOpen ? (
        <NewGroupPanel
          identity={identity}
          busy={busy}
          error={createError}
          name={createDraftName}
          avatarColor={createDraftColor}
          onNameChange={setCreateDraftName}
          onAvatarColorChange={setCreateDraftColor}
          onClose={() => {
            createSidebarBaselineRef.current = null;
            setCreateOpen(false);
            setCreateError(undefined);
          }}
          onCreate={onCreate}
        />
      ) : detailsOpen && selectedId && !selectedIsInvite && !selectedIsJoining ? (
        <GroupDetails
          key={selectedId}
          coId={selectedId}
          name={selectedChat?.name || "Group chat"}
          identity={identity}
          participants={selectedParticipants}
          pendingInvites={selectedPendingInvites}
          busy={busy}
          onClose={() => setDetailsOpen(false)}
          onLeave={onLeave}
          onRemoveParticipant={onRemoveParticipant}
          onInvite={onInvite}
          onRevokeInvite={onRevokeInvite}
          onSave={onSaveGroupDetails}
        />
      ) : selectedId && (selectedIsInvite || selectedIsJoining) ? (
        <InviteAcceptPane
          key={selectedId}
          coId={selectedId}
          name={selectedChat?.name}
          inviterName={selectedChat?.inviterName}
          pending={selectedIsJoining}
          busy={busy}
          error={inviteError}
          onAccept={() => void onAcceptInvite(selectedId)}
          onDecline={() => void onDeclineInvite(selectedId)}
        />
      ) : selectedId ? (
        <ChatPane
          key={selectedId}
          coId={selectedId}
          identity={identity}
          fallbackName={selectedChat?.name}
          onOpenDetails={() => setDetailsOpen(true)}
          onMessagesSeen={onMessagesSeen}
        />
      ) : (
        <div
          data-tauri-drag-region
          className="content-pane flex flex-1 items-center justify-center"
        >
          <p className="type-body-regular text-muted">
            {localSession ? "No chat selected" : "Starting…"}
          </p>
        </div>
      )}
    </div>
  );
}
