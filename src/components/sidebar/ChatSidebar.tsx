import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  readProfileName,
  subscribeProfileName,
  truncateDid,
  type GroupAvatarColor,
} from "../../lib/messenger";
import { cn } from "../../lib/utils";
import { Button } from "../global/Button";
import { GroupAvatar } from "../global/GroupAvatar";
import { EmptyState } from "./EmptyState";
import { ChatListItem } from "./ChatListItem";
import { Icon } from "../global/icons/Icon";
import type { ChatListEntry } from "./chat-list-types";

export type { ChatListEntry } from "./chat-list-types";

type Props = {
  chats: ChatListEntry[];
  selectedId?: string;
  creating?: boolean;
  createDraftName?: string;
  createDraftColor?: GroupAvatarColor | string;
  onSelect: (coId: string) => void;
  onCreate: () => void;
  onOpenProfile?: () => void;
  identity?: string;
};

const SIDEBAR_WIDTH_KEY = "co-messenger.sidebar-width";
const DEFAULT_WIDTH = 288;
const MIN_WIDTH = 220;
const MAX_WIDTH = 480;

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (raw == null) return DEFAULT_WIDTH;
    const value = Number(raw);
    if (!Number.isFinite(value)) return DEFAULT_WIDTH;
    return clampWidth(value);
  } catch {
    return DEFAULT_WIDTH;
  }
}

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

function persistWidth(width: number) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch {
    // ignore quota / private mode
  }
}

function NewGroupDraftItem({
  selected,
  name,
  color,
  onSelect,
}: {
  selected?: boolean;
  name: string;
  color: string;
  onSelect: () => void;
}) {
  const title = name.trim() || "New Group";

  return (
    <Button
      variant="bare"
      onPress={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-[12px] border-0 px-3 py-2 text-left",
        selected ? "bg-surface-selected" : "interactive",
      )}
      aria-label={title}
    >
      <GroupAvatar color={color} className="size-12" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="type-body truncate text-foreground">{title}</span>
        <p className="h-9 min-w-0 line-clamp-2 type-body-regular text-muted">
          No messages yet
        </p>
      </div>
    </Button>
  );
}

export function ChatSidebar({
  chats,
  selectedId,
  creating = false,
  createDraftName = "",
  createDraftColor = "#888888",
  onSelect,
  onCreate,
  onOpenProfile,
  identity,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState(readStoredWidth);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;
  const profileName = useSyncExternalStore(
    subscribeProfileName,
    readProfileName,
    () => "",
  );

  async function copyIdentity() {
    if (!identity) return;
    await navigator.clipboard.writeText(identity);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      setResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const startX = e.clientX;
      const startWidth = widthRef.current;

      function onPointerMove(ev: PointerEvent) {
        const next = clampWidth(startWidth + (ev.clientX - startX));
        setWidth(next);
        widthRef.current = next;
      }

      function onPointerUp(ev: PointerEvent) {
        handle.releasePointerCapture(ev.pointerId);
        setResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        persistWidth(widthRef.current);
        handle.removeEventListener("pointermove", onPointerMove);
        handle.removeEventListener("pointerup", onPointerUp);
        handle.removeEventListener("pointercancel", onPointerUp);
      }

      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerUp);
      handle.addEventListener("pointercancel", onPointerUp);
    },
    [],
  );

  useEffect(() => {
    if (!resizing) return;
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  const invites = useMemo(() => chats.filter((chat) => chat.invited), [chats]);
  const activeChats = useMemo(
    () =>
      chats
        .filter((chat) => !chat.invited)
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    [chats],
  );

  const showEmpty = chats.length === 0 && !creating;

  return (
    <aside
      data-resizing={resizing ? "" : undefined}
      className="sidebar-pane relative flex h-full shrink-0 flex-col border-r border-separator text-foreground"
      style={{ width }}
    >
      <header className="flex h-12 items-center gap-2 pl-[78px] pr-2">
        <div
          data-tauri-drag-region
          className="min-w-0 flex-1 self-stretch"
          aria-hidden="true"
        />
        <Button variant="icon" onPress={onCreate} aria-label="Create group">
          <Icon name="plus" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {showEmpty ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <div className="flex flex-col gap-4">
            {invites.length > 0 && (
              <section
                className="flex flex-col gap-0.5"
                aria-labelledby="sidebar-invites-heading"
              >
                <h2
                  id="sidebar-invites-heading"
                  className="px-3 pb-1 type-body-regular text-muted"
                >
                  Invites
                </h2>
                {invites.map((chat) => (
                  <ChatListItem
                    key={chat.coId}
                    chat={chat}
                    selected={!creating && chat.coId === selectedId}
                    onSelect={() => onSelect(chat.coId)}
                  />
                ))}
              </section>
            )}
            <section
              className="flex flex-col gap-0.5"
              aria-labelledby={invites.length > 0 ? "sidebar-groups-heading" : undefined}
              aria-label={invites.length > 0 ? undefined : "Chats"}
            >
              {invites.length > 0 && (
                <h2
                  id="sidebar-groups-heading"
                  className="px-3 pb-1 type-body-regular text-muted"
                >
                  Groups
                </h2>
              )}
              {creating && (
                <NewGroupDraftItem
                  selected
                  name={createDraftName}
                  color={createDraftColor}
                  onSelect={onCreate}
                />
              )}
              {activeChats.map((chat) => (
                <ChatListItem
                  key={chat.coId}
                  chat={chat}
                  selected={!creating && chat.coId === selectedId}
                  onSelect={() => onSelect(chat.coId)}
                />
              ))}
            </section>
          </div>
        )}
      </div>

      <footer className="px-2 py-2">
        {identity ? (
          <div className="interactive relative rounded-[12px]">
            <Button
              variant="bare"
              onPress={onOpenProfile}
              className="w-full rounded-[12px] border-0 px-3 py-2 pr-10 text-left"
              aria-label="Open profile"
            >
              <p className="truncate type-body text-foreground">
                {profileName || "Set your name"}
              </p>
              <p
                className="truncate type-body-regular text-muted"
                title={identity}
              >
                {truncateDid(identity, 28)}
              </p>
            </Button>
            <Button
              variant="icon"
              onPress={() => void copyIdentity()}
              aria-label={copied ? "Copied" : "Copy your ID"}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2"
            >
              <Icon name={copied ? "check" : "copy"} />
            </Button>
          </div>
        ) : (
          <p className="px-3 type-body-regular text-muted">
            Setting up your ID…
          </p>
        )}
      </footer>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        onPointerDown={onResizePointerDown}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const delta = e.key === "ArrowRight" ? 8 : -8;
          const next = clampWidth(widthRef.current + delta);
          setWidth(next);
          persistWidth(next);
        }}
        data-sidebar-resize
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none"
      />
    </aside>
  );
}
