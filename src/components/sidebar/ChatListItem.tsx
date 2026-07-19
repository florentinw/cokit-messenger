import { cn } from "@/lib/utils";
import { Button } from "@/components/global/Button";
import { GroupAvatar } from "@/components/global/GroupAvatar";
import type { ChatListRow } from "@/components/sidebar/chat-list-types";

type Props = {
  row: ChatListRow;
  selected?: boolean;
  onSelect: () => void;
};

export function ChatListItem({ row, selected, onSelect }: Props) {
  const { id, title, subtitle, meta, badge, color } = row;
  const showBadge = (badge ?? 0) > 0;

  return (
    <Button
      variant="bare"
      onPress={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-[12px] border-0 px-3 py-2 text-left",
        selected ? "bg-surface-selected" : "interactive",
      )}
    >
      <GroupAvatar coId={id} color={color} className="size-12" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "type-body truncate text-foreground",
              showBadge && "font-semibold",
            )}
          >
            {title}
          </span>
          {meta !== undefined && (
            <span
              className={cn(
                "shrink-0 type-body-regular",
                showBadge ? "text-foreground" : "text-muted",
              )}
            >
              {meta}
            </span>
          )}
        </div>
        <div className="flex h-9 items-start justify-between gap-2">
          <p className="min-w-0 flex-1 line-clamp-2 type-body-regular text-muted">
            {subtitle}
          </p>
          {showBadge && (
            <span
              className="box-border inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-warm-charcoal)] px-1 text-[11px] font-semibold leading-none tracking-[-0.195px] text-[var(--color-warm-white)]"
              aria-label={`${badge} unread`}
            >
              {(badge ?? 0) > 9 ? "9+" : badge}
            </span>
          )}
        </div>
      </div>
    </Button>
  );
}
