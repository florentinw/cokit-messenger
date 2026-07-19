import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  chatStore,
  DEFAULT_GROUP_AVATAR_COLOR,
  displayName,
  formatChatTime,
  IDENTITY_NAME,
  markChatRead,
  localMembershipStateFor,
  publishDisplayNameToGroups,
  RESET_LOCAL_DATA_HINT,
  TAURI_REQUIRED_MESSAGE,
  truncateDid,
  useChatStoreRevision,
} from "../lib/messenger";
import {
  LOCAL_MEMBERSHIP_CORE,
  LocalMembershipState,
  errorDetail,
  formatCoError,
  isTauriRuntimeAvailable,
  useCoSession,
  useCore,
  useIdentity,
  type LocalMemberships,
} from "../lib/co-sdk-extras";
import { ChatPane } from "./chat/ChatPane";
import { ChatSidebar, type ChatListRow } from "./sidebar/ChatSidebar";
import { GroupDetails } from "./chat-details/GroupDetails";
import { IdentityLoadingScreen } from "./global/IdentityLoadingScreen";
import { InviteAcceptPane } from "./chat/InviteAcceptPane";
import { NewGroupPanel, type CreateDraft } from "./chat-details/NewGroupPanel";
import { ProfilePanel } from "./global/ProfilePanel";
import { CorruptStorageHint, ErrorCard } from "./global/ErrorCard";
import { useMemberships } from "./hooks/useMemberships";
import {
  useChatHydration,
  useChatStateMultiplexer,
} from "./hooks/useChatPipeline";
import { useCoMembers } from "./hooks/useCoMembers";
import { useChatMutations } from "./hooks/useChatMutations";
import { paneChatId, type Pane } from "./pane";

export function AppShell() {
  const { sessionId: localSession, error: sessionError } = useCoSession("local");
  const { identity, error: identityError } = useIdentity(IDENTITY_NAME, localSession);
  const membershipsState = useCore<LocalMemberships>("local", LOCAL_MEMBERSHIP_CORE);

  const [pane, setPane] = useState<Pane>({ kind: "empty" });
  const [createDraft, setCreateDraft] = useState<CreateDraft>({
    name: "",
    color: DEFAULT_GROUP_AVATAR_COLOR,
  });
  const [createError, setCreateError] = useState<string>();
  const [inviteError, setInviteError] = useState<string>();
  const chatStoreRevision = useChatStoreRevision();

  const focusedId = paneChatId(pane);
  const creating = pane.kind === "create";
  const detailsOpen = pane.kind === "details";

  const { memberships, setMemberships, sidebarMemberships, activeCoIds } = useMemberships(
    localSession,
    membershipsState,
    identity,
  );

  const selectedIdRef = useRef(focusedId);
  selectedIdRef.current = focusedId;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const activeIdsRef = useRef<Set<string>>(new Set());
  activeIdsRef.current = new Set(activeCoIds);
  const createSidebarBaselineRef = useRef<Set<string> | null>(null);
  const membershipIdsRef = useRef<Set<string>>(new Set());
  membershipIdsRef.current = new Set(memberships.map((m) => m.id));

  const nav = useMemo(
    () => ({
      openChat: (id: string) => setPane({ kind: "chat", id }),
      openEmpty: () => setPane({ kind: "empty" }),
      setPane,
    }),
    [],
  );

  useChatHydration(localSession, sidebarMemberships, identity, selectedIdRef);
  useChatStateMultiplexer(activeIdsRef, selectedIdRef, identityRef);

  const selectedMembership = memberships.find((m) => m.id === focusedId);
  const { selectedMembers, selectedPendingInvites, bumpRoster } = useCoMembers(
    focusedId,
    identity,
    selectedMembership,
    detailsOpen,
  );

  const {
    onCreate,
    onLeave,
    onRemoveCoMember,
    onRevokeInvite,
    onInvite,
    onMessagesSeen,
    onSaveGroupDetails,
    onAcceptInvite,
    onDeclineInvite,
  } = useChatMutations({
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
  });

  const { inviteRows, chatRows } = useMemo(() => {
    const baseline = createSidebarBaselineRef.current;
    const source =
      creating && baseline
        ? sidebarMemberships.filter((m) => baseline.has(m.id))
        : sidebarMemberships;

    const invites: ChatListRow[] = [];
    const chats: { row: ChatListRow; timestamp: number }[] = [];

    for (const m of source) {
      const state = localMembershipStateFor(m, identity);
      const invited = state === LocalMembershipState.Invite;
      const joining =
        state === LocalMembershipState.Join || state === LocalMembershipState.Pending;
      const meta = chatStore.get(m.id);
      const resolvedName =
        meta?.name && meta.name !== "Group chat" && meta.name !== m.id
          ? meta.name
          : undefined;
      const title =
        resolvedName ??
        (invited || joining ? truncateDid(m.id, 22) : (meta?.name ?? "Group chat"));
      const color = meta?.color;
      const inviterLabel = meta?.inviterDid
        ? displayName(meta.inviterDid)
        : meta?.inviterName;

      if (invited) {
        invites.push({
          id: m.id,
          title,
          subtitle: inviterLabel
            ? `${inviterLabel} invited you`
            : "You’ve been invited to this group",
          meta: "Invited",
          color,
        });
        continue;
      }

      if (joining) {
        chats.push({
          timestamp: 0,
          row: {
            id: m.id,
            title,
            subtitle: "Joining this group…",
            meta: "Joining",
            color,
          },
        });
        continue;
      }

      const unread = meta?.unread ?? 0;
      const timestamp = meta?.timestamp ?? 0;
      chats.push({
        timestamp,
        row: {
          id: m.id,
          title,
          subtitle: meta?.preview || "No messages yet",
          meta: timestamp ? formatChatTime(timestamp) : undefined,
          badge: unread > 0 ? unread : undefined,
          color,
        },
      });
    }

    chats.sort((a, b) => b.timestamp - a.timestamp);
    return {
      inviteRows: invites,
      chatRows: chats.map((c) => c.row),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarMemberships, identity, chatStoreRevision, creating]);

  const selectedChatTitle = focusedId
    ? (chatRows.find((c) => c.id === focusedId)?.title ??
      inviteRows.find((c) => c.id === focusedId)?.title)
    : undefined;
  const selectedMembershipState = selectedMembership
    ? localMembershipStateFor(selectedMembership, identity)
    : undefined;
  const selectedIsInvite = selectedMembershipState === LocalMembershipState.Invite;
  const selectedIsJoining =
    selectedMembershipState === LocalMembershipState.Join ||
    selectedMembershipState === LocalMembershipState.Pending;

  const bootstrappedRef = useRef(false);
  if (localSession && identity) bootstrappedRef.current = true;
  const isBootstrapping =
    !bootstrappedRef.current && (!localSession || (!identity && !identityError));

  if (sessionError || identityError) {
    const notInTauri = !isTauriRuntimeAvailable() && sessionError;
    const formatted = formatCoError(sessionError ?? identityError);
    const isCorruptStorage = formatted.type === "corrupt_storage";
    const errorTitle = notInTauri
      ? "Open the desktop app"
      : isCorruptStorage
        ? "Local CO data needs reset"
        : sessionError
          ? "Could not open local session"
          : "Could not load identity";
    const rawMessage = sessionError
      ? notInTauri
        ? TAURI_REQUIRED_MESSAGE
        : errorDetail(sessionError)
      : errorDetail(identityError);
    const copyMessage = `${errorTitle}\n\n${rawMessage}${isCorruptStorage ? `\n\n${RESET_LOCAL_DATA_HINT}` : ""}`;

    return (
      <ErrorCard
        title={errorTitle}
        message={formatted.summary}
        copyText={copyMessage}
        hint={isCorruptStorage ? <CorruptStorageHint /> : undefined}
        details={rawMessage}
      />
    );
  }

  if (isBootstrapping) {
    return (
      <IdentityLoadingScreen
        message={localSession ? "Setting up your identity…" : "Starting…"}
      />
    );
  }

  const sidebarSelectedId =
    pane.kind === "chat" || pane.kind === "details" ? pane.id : undefined;

  function renderEmptyPane(): ReactNode {
    return (
      <div
        data-tauri-drag-region
        className="content-pane flex flex-1 items-center justify-center"
      >
        <p className="type-body-regular text-muted">
          {localSession ? "No chat selected" : "Starting…"}
        </p>
      </div>
    );
  }

  function renderMainPane(): ReactNode {
    switch (pane.kind) {
      case "profile":
        return (
          <ProfilePanel
            identity={identity}
            onClose={() => setPane({ kind: "empty" })}
            onSaved={(name) => {
              if (identity && activeCoIds.length > 0) {
                void publishDisplayNameToGroups(identity, name, activeCoIds);
              }
            }}
          />
        );
      case "create":
        return (
          <NewGroupPanel
            identity={identity}
            error={createError}
            onDraftChange={setCreateDraft}
            onClose={() => {
              createSidebarBaselineRef.current = null;
              setCreateError(undefined);
              setPane({ kind: "empty" });
            }}
            onCreate={onCreate}
          />
        );
      case "details":
      case "chat": {
        if (!focusedId) return renderEmptyPane();
        if (selectedIsInvite || selectedIsJoining) {
          return (
            <InviteAcceptPane
              key={focusedId}
              coId={focusedId}
              pending={selectedIsJoining}
              error={inviteError}
              onAccept={() => onAcceptInvite(focusedId)}
              onDecline={() => onDeclineInvite(focusedId)}
            />
          );
        }
        if (pane.kind === "details") {
          return (
            <GroupDetails
              key={focusedId}
              coId={focusedId}
              identity={identity}
              members={selectedMembers}
              pendingInvites={selectedPendingInvites}
              onClose={() => setPane({ kind: "chat", id: focusedId })}
              onLeave={onLeave}
              onRemoveCoMember={onRemoveCoMember}
              onInvite={onInvite}
              onRevokeInvite={onRevokeInvite}
              onSave={onSaveGroupDetails}
            />
          );
        }
        return (
          <ChatPane
            key={focusedId}
            coId={focusedId}
            identity={identity}
            fallbackName={selectedChatTitle}
            onOpenDetails={() => setPane({ kind: "details", id: focusedId })}
            onMessagesSeen={onMessagesSeen}
          />
        );
      }
      case "empty":
        return renderEmptyPane();
      default: {
        const _exhaustive: never = pane;
        return _exhaustive;
      }
    }
  }

  return (
    <div className="layer-ground relative flex h-full w-full overflow-hidden">
      <ChatSidebar
        invites={inviteRows}
        chats={chatRows}
        selectedId={sidebarSelectedId}
        creating={creating}
        createDraftName={createDraft.name}
        createDraftColor={createDraft.color}
        onSelect={(id) => {
          createSidebarBaselineRef.current = null;
          setPane({ kind: "chat", id });
          const meta = chatStore.get(id);
          markChatRead(id, meta?.timestamp ?? Date.now());
          chatStore.applyLocal(id, { unread: 0 });
        }}
        onCreate={() => {
          setCreateError(undefined);
          setCreateDraft({ name: "", color: DEFAULT_GROUP_AVATAR_COLOR });
          createSidebarBaselineRef.current = null;
          setPane({ kind: "create" });
        }}
        onOpenProfile={() => {
          createSidebarBaselineRef.current = null;
          setPane({ kind: "profile" });
        }}
        identity={identity}
      />

      {renderMainPane()}
    </div>
  );
}
