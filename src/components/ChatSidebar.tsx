import { useState } from "react";
import { truncateDid } from "../lib/messenger";
import { EmptyState } from "./EmptyState";
import { ChatListItem } from "./ChatListItem";
import { Icon } from "./Icon";

export type ChatListEntry = {
  coId: string;
  name: string;
  preview?: string;
  timestamp?: number;
};

type Props = {
  chats: ChatListEntry[];
  selectedId?: string;
  onSelect: (coId: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  identity?: string;
};

export function ChatSidebar({
  chats,
  selectedId,
  onSelect,
  onCreate,
  onJoin,
  identity,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copyIdentity() {
    if (!identity) return;
    await navigator.clipboard.writeText(identity);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <aside className="relative flex h-full w-72 shrink-0 flex-col border-r border-border bg-bg-elevated">
      {/* pl leaves room for native macOS traffic lights (titleBarStyle: Overlay) */}
      <header
        data-tauri-drag-region
        className="flex h-12 items-center justify-end gap-2 px-4 pl-[78px]"
      >
        <button
          type="button"
          onClick={onJoin}
          className="flex h-7 items-center rounded-lg px-2 text-[12px] font-medium text-secondary hover:bg-bg-elevated-2"
        >
          Join
        </button>
        <button
          type="button"
          onClick={onCreate}
          aria-label="Create group"
          className="btn-icon text-primary"
        >
          <Icon name="plus" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {chats.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <div className="flex flex-col">
            {chats.map((chat) => (
              <ChatListItem
                key={chat.coId}
                coId={chat.coId}
                name={chat.name}
                preview={chat.preview}
                timestamp={chat.timestamp}
                selected={chat.coId === selectedId}
                onSelect={() => onSelect(chat.coId)}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-border px-3 py-2">
        {identity ? (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium tracking-[-0.12px] text-secondary">
                Your ID
              </p>
              <p
                className="truncate text-[11px] tracking-[-0.12px] text-primary"
                title={identity}
              >
                {truncateDid(identity, 28)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyIdentity()}
              aria-label="Copy your ID"
              className="btn-icon text-primary"
              title={copied ? "Copied" : "Copy ID"}
            >
              <Icon name="copy" />
            </button>
          </div>
        ) : (
          <p className="text-[11px] tracking-[-0.12px] text-secondary">
            Setting up your ID…
          </p>
        )}
        {copied && (
          <p className="mt-1 text-[11px] text-secondary">Copied to clipboard</p>
        )}
      </footer>
    </aside>
  );
}
