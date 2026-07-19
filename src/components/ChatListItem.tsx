import { avatarForCo, formatChatTime } from "../lib/messenger";
import { Icon } from "./Icon";

type Props = {
  coId: string;
  name: string;
  preview?: string;
  timestamp?: number;
  selected?: boolean;
  unread?: number;
  onSelect: () => void;
};

export function ChatListItem({
  coId,
  name,
  preview,
  timestamp,
  selected,
  unread,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
        selected ? "bg-bg-elevated-2" : "hover:bg-bg-elevated-2/60"
      }`}
    >
      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-bg-base">
        <img src={avatarForCo(coId)} alt="" className="size-full object-cover p-2" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 text-[14px]">
          <span className="truncate font-medium tracking-[-0.14px] text-primary">{name}</span>
          {timestamp !== undefined && (
            <span className="shrink-0 text-secondary tracking-[-0.21px]">
              {formatChatTime(timestamp)}
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 text-[14px] leading-[18px] tracking-[-0.14px] text-secondary">
            {preview || "No messages yet"}
          </p>
          {unread !== undefined && unread > 0 && (
            <span className="relative mt-0.5 inline-flex size-6 shrink-0 items-center justify-center">
              <Icon name="badge" className="text-primary" />
              <span className="absolute text-[13px] font-semibold leading-4 text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
