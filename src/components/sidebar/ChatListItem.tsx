import { formatChatTime } from "../../lib/messenger";
import { cn } from "../../lib/utils";
import { Button } from "../global/Button";
import { GroupAvatar } from "../global/GroupAvatar";

type Props = {
  coId: string;
  name: string;
  preview?: string;
  timestamp?: number;
  selected?: boolean;
  unread?: number;
  /** Pending invite — show Invited label instead of time/unread. */
  invited?: boolean;
  /** Accepted invite, waiting for Active membership. */
  joining?: boolean;
  inviterName?: string;
  onSelect: () => void;
};

export function ChatListItem({
  coId,
  name,
  preview,
  timestamp,
  selected,
  unread,
  invited,
  joining,
  inviterName,
  onSelect,
}: Props) {
  const hasUnread = !invited && !joining && (unread ?? 0) > 0;
  const invitePreview = inviterName
    ? `${inviterName} invited you`
    : "You’ve been invited to this group";

  return (
    <Button
      variant="bare"
      onPress={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-[12px] border-0 px-3 py-2 text-left",
        selected ? "bg-surface-selected" : "interactive",
      )}
    >
      <GroupAvatar coId={coId} className="size-12" syncFromCo={!invited && !joining} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "type-body truncate text-foreground",
              hasUnread && "font-semibold",
            )}
          >
            {name}
          </span>
          {invited || joining ? (
            <span className="shrink-0 type-body-regular text-muted">
              {joining ? "Joining" : "Invited"}
            </span>
          ) : (
            timestamp !== undefined && (
              <span
                className={cn(
                  "shrink-0 type-body-regular",
                  hasUnread ? "text-foreground" : "text-muted",
                )}
              >
                {formatChatTime(timestamp)}
              </span>
            )
          )}
        </div>
        <div className="flex h-9 items-start justify-between gap-2">
          <p className="min-w-0 flex-1 line-clamp-2 type-body-regular text-muted">
            {joining
              ? "Joining this group…"
              : invited
                ? invitePreview
                : preview || "No messages yet"}
          </p>
          {hasUnread && (
            <span
              className="box-border inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-warm-charcoal)] px-1 text-[11px] font-semibold leading-none tracking-[-0.195px] text-[var(--color-warm-white)]"
              aria-label={`${unread} unread`}
            >
              {(unread ?? 0) > 9 ? "9+" : unread}
            </span>
          )}
        </div>
      </div>
    </Button>
  );
}
