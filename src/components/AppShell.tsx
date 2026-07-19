import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CO_CORE_NAME_MEMBERSHIP,
  IDENTITY_NAME,
  MembershipState,
  TAURI_REQUIRED_MESSAGE,
  getCoState,
  isMockCoEnabled,
  isTauriRuntimeAvailable,
  resolveCid,
  sessionClose,
  sessionOpen,
  useCo,
  useCoCore,
  useCoSession,
  useDidKeyIdentity,
  useResolveCid,
  type Membership,
  type Memberships,
  type RoomState,
} from "../lib/co-sdk";
import {
  collectMembershipList,
  createGroupChat,
  isSidebarMembership,
  joinMembership,
  leaveMembership,
  membershipStateFor,
} from "../lib/messenger";
import { ChatPane } from "./ChatPane";
import { ChatSidebar, type ChatListEntry } from "./ChatSidebar";
import { GroupDetails } from "./GroupDetails";
import { Icon } from "./Icon";
import { JoinGroupModal } from "./JoinGroupModal";
import { NewGroupPanel } from "./NewGroupPanel";

async function loadChatMeta(
  coId: string,
): Promise<Pick<ChatListEntry, "name" | "preview" | "timestamp">> {
  try {
    const session = await sessionOpen(coId);
    try {
      const [stateCid] = await getCoState(coId);
      if (!stateCid) return { name: "Group chat" };
      const co = (await resolveCid(session, stateCid)) as {
        n?: string;
        c?: Record<string, { state?: import("multiformats").CID }>;
      };
      const roomCid = co.c?.room?.state;
      let name = co.n || "Group chat";
      if (roomCid) {
        const room = (await resolveCid(session, roomCid)) as RoomState;
        if (room?.name) name = room.name;
      }
      return { name };
    } finally {
      await sessionClose(session);
    }
  } catch {
    return { name: "Group chat" };
  }
}

export function AppShell() {
  const { sessionId: localSession, error: sessionError } = useCoSession("local");
  const identity = useDidKeyIdentity(IDENTITY_NAME, localSession);
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
  const [joinOpen, setJoinOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [joinError, setJoinError] = useState<string>();
  const [errorCopied, setErrorCopied] = useState(false);
  const [chatMeta, setChatMeta] = useState<Record<string, ChatListEntry>>({});
  const [memberships, setMemberships] = useState<Membership[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadMemberships() {
      if (!localSession) {
        if (!cancelled) setMemberships([]);
        return;
      }
      const raw = membershipsState?.memberships ?? membershipsState;
      const list = await collectMembershipList(localSession, raw);
      if (!cancelled) {
        setMemberships(list.filter((m) => m.id && m.id !== "local"));
      }
    }
    void loadMemberships();
    return () => {
      cancelled = true;
    };
  }, [localSession, membershipsState, membershipCoreCid, localHeads]);

  const sidebarMemberships = useMemo(
    () => memberships.filter((m) => isSidebarMembership(m, identity)),
    [memberships, identity],
  );

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const next: Record<string, ChatListEntry> = {};
      for (const m of sidebarMemberships) {
        const meta = await loadChatMeta(m.id);
        next[m.id] = { coId: m.id, ...meta };
      }
      if (!cancelled) setChatMeta(next);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [sidebarMemberships]);

  const chats: ChatListEntry[] = useMemo(
    () =>
      sidebarMemberships.map((m) => chatMeta[m.id] ?? { coId: m.id, name: "Group chat" }),
    [sidebarMemberships, chatMeta],
  );

  useEffect(() => {
    if (selectedId && !chats.some((c) => c.coId === selectedId)) {
      setSelectedId(undefined);
      setDetailsOpen(false);
    }
  }, [chats, selectedId]);

  const selectedChat = chats.find((c) => c.coId === selectedId);

  const onCreate = useCallback(
    async (name: string) => {
      if (!identity) {
        setCreateError("Identity is not ready yet. Wait a moment and try again.");
        return;
      }
      if (!localSession) {
        setCreateError("Local session is not ready yet. Wait a moment and try again.");
        return;
      }
      setBusy(true);
      setCreateError(undefined);
      try {
        const coId = await createGroupChat(identity, name);
        await joinMembership(localSession, identity, coId);
        setMemberships((prev) => {
          if (prev.some((m) => m.id === coId)) return prev;
          return [...prev, { id: coId, did: { [identity]: MembershipState.Active } }];
        });
        setChatMeta((prev) => ({ ...prev, [coId]: { coId, name } }));
        setSelectedId(coId);
        setCreateOpen(false);
      } catch (err) {
        console.error(err);
        setCreateError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [identity, localSession],
  );

  const onJoin = useCallback(
    async (coId: string) => {
      if (!identity || !localSession) {
        setJoinError("Identity or session is not ready yet. Wait a moment and try again.");
        return;
      }
      setBusy(true);
      setJoinError(undefined);
      try {
        await joinMembership(localSession, identity, coId);
        setSelectedId(coId);
        setJoinOpen(false);
      } catch (err) {
        console.error(err);
        setJoinError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [identity, localSession],
  );

  const onLeave = useCallback(async () => {
    if (!identity || !localSession || !selectedId) return;
    await leaveMembership(localSession, identity, selectedId);
    setDetailsOpen(false);
    setSelectedId(undefined);
  }, [identity, localSession, selectedId]);

  const invited = memberships.filter(
    (m) => membershipStateFor(m, identity) === MembershipState.Invite,
  );

  if (sessionError) {
    const notInTauri = !isTauriRuntimeAvailable();
    const errorTitle = notInTauri
      ? "Open the desktop app"
      : "Could not open local session";
    const errorMessage = notInTauri
      ? TAURI_REQUIRED_MESSAGE
      : sessionError.stack?.trim() || sessionError.message;

    async function copyError() {
      await navigator.clipboard.writeText(`${errorTitle}\n\n${errorMessage}`);
      setErrorCopied(true);
      window.setTimeout(() => setErrorCopied(false), 1500);
    }

    return (
      <div className="flex h-full items-center justify-center bg-bg-elevated p-8 text-primary">
        <div className="max-w-md rounded-xl bg-bg-base p-6 shadow">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-semibold">{errorTitle}</h1>
            <button
              type="button"
              onClick={() => void copyError()}
              aria-label="Copy error"
              className="btn-icon"
              title={errorCopied ? "Copied" : "Copy error"}
            >
              <Icon name="copy" className="text-primary" />
            </button>
          </div>
          <p className="mt-3 max-h-48 overflow-auto text-sm text-secondary whitespace-pre-wrap break-words">
            {errorMessage}
          </p>
          {errorCopied && (
            <p className="mt-2 text-[11px] text-secondary">Copied to clipboard</p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 flex h-7 items-center justify-center rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:opacity-90"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-bg-base">
      {isMockCoEnabled() && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
          <span className="rounded-b-lg bg-amber-500/90 px-3 py-1 text-[11px] font-medium tracking-wide text-amber-950">
            UI preview (mock data — not connected to CO)
          </span>
        </div>
      )}
      <ChatSidebar
        chats={chats}
        selectedId={createOpen ? undefined : selectedId}
        onSelect={(id) => {
          setCreateOpen(false);
          setSelectedId(id);
        }}
        onCreate={() => {
          setCreateError(undefined);
          setCreateOpen(true);
        }}
        onJoin={() => setJoinOpen(true)}
        identity={identity}
      />

      {createOpen ? (
        <NewGroupPanel
          identity={identity}
          busy={busy}
          error={createError}
          onClose={() => {
            setCreateOpen(false);
            setCreateError(undefined);
          }}
          onCreate={onCreate}
        />
      ) : selectedId ? (
        <ChatPane
          coId={selectedId}
          identity={identity}
          fallbackName={selectedChat?.name}
          onOpenDetails={() => setDetailsOpen(true)}
        />
      ) : (
        <div
          data-tauri-drag-region
          className="flex flex-1 items-center justify-center bg-bg-base"
        >
          <p className="text-[20px] font-semibold tracking-[-0.3px] text-secondary">
            {localSession ? "No chat selected" : "Starting…"}
          </p>
        </div>
      )}

      {invited.length > 0 && !createOpen && (
        <div className="absolute bottom-4 left-4 z-10 max-w-64 rounded-xl bg-bg-base p-3 shadow-lg">
          <p className="text-[12px] font-medium text-secondary">Invites</p>
          {invited.map((m: Membership) => (
            <button
              key={m.id}
              type="button"
              className="mt-1 flex h-7 w-full items-center truncate rounded-lg bg-bg-elevated px-2 text-left text-[12px] text-primary"
              onClick={() => void onJoin(m.id)}
            >
              Join {m.id}
            </button>
          ))}
        </div>
      )}

      <JoinGroupModal
        open={joinOpen}
        busy={busy}
        error={joinError}
        onClose={() => {
          setJoinOpen(false);
          setJoinError(undefined);
        }}
        onJoin={onJoin}
      />
      {selectedId && !createOpen && (
        <GroupDetails
          open={detailsOpen}
          coId={selectedId}
          name={selectedChat?.name || "Group chat"}
          identity={identity}
          participants={identity ? [identity] : []}
          onClose={() => setDetailsOpen(false)}
          onLeave={onLeave}
        />
      )}
    </div>
  );
}
