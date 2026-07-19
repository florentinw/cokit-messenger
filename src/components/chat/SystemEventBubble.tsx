import type { ComponentType, SVGProps } from "react";
import { useSyncExternalStore } from "react";
import {
  getPeerNamesRevision,
  subscribePeerNames,
  systemEventTextParts,
  type SystemTimelineEvent,
} from "@/lib/messenger";
import SystemEditIcon from "@/components/global/icons/svgs/system-edit.svg?react";
import SystemMemberAddedIcon from "@/components/global/icons/svgs/system-member-added.svg?react";
import SystemMemberRemovedIcon from "@/components/global/icons/svgs/system-member-removed.svg?react";
import SystemPlusIcon from "@/components/global/icons/svgs/system-plus.svg?react";

const icons = {
  group_created: SystemPlusIcon,
  member_added: SystemMemberAddedIcon,
  member_removed: SystemMemberRemovedIcon,
  group_icon_changed: SystemEditIcon,
  group_name_changed: SystemEditIcon,
} as const satisfies Record<SystemTimelineEvent["variant"], ComponentType<SVGProps<SVGSVGElement>>>;

type Props = {
  event: SystemTimelineEvent;
  identity?: string;
};

export function SystemEventBubble({ event, identity }: Props) {
  useSyncExternalStore(subscribePeerNames, getPeerNamesRevision, () => 0);
  const Icon = icons[event.variant];
  const parts = systemEventTextParts(event, identity);

  return (
    <div className="flex items-center gap-2">
      <Icon className="size-6 shrink-0" aria-hidden />
      <p className="min-w-0 type-caption text-muted">
        {parts.map((part, index) =>
          part.emphasis ? (
            <span key={index} className="font-medium text-foreground">
              {part.text}
            </span>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
    </div>
  );
}
