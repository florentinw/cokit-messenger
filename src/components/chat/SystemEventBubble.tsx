import type { ComponentType, SVGProps } from "react";
import { useSyncExternalStore } from "react";
import {
  displayName,
  getPeerNamesRevision,
  subscribePeerNames,
  type SystemTimelineEvent,
} from "../../lib/messenger";
import SystemEditIcon from "../global/icons/svgs/system-edit.svg?react";
import SystemMemberAddedIcon from "../global/icons/svgs/system-member-added.svg?react";
import SystemMemberRemovedIcon from "../global/icons/svgs/system-member-removed.svg?react";
import SystemPlusIcon from "../global/icons/svgs/system-plus.svg?react";

const icons = {
  group_created: SystemPlusIcon,
  member_added: SystemMemberAddedIcon,
  member_removed: SystemMemberRemovedIcon,
  group_icon_changed: SystemEditIcon,
  group_name_changed: SystemEditIcon,
} as const satisfies Record<SystemTimelineEvent["variant"], ComponentType<SVGProps<SVGSVGElement>>>;

type TextPart = {
  text: string;
  emphasis?: boolean;
};

function eventParts(event: SystemTimelineEvent, selfDid?: string): TextPart[] {
  const actorName = displayName(event.actorDid, selfDid);

  switch (event.variant) {
    case "group_created": {
      const members = event.members.map((did) => displayName(did, selfDid));
      if (members.length === 0) {
        return [
          { text: actorName, emphasis: true },
          { text: " created this group." },
        ];
      }
      if (members.length === 1) {
        return [
          { text: actorName, emphasis: true },
          { text: " created this group with " },
          { text: members[0], emphasis: true },
          { text: "." },
        ];
      }
      const last = members[members.length - 1];
      const rest = members.slice(0, -1);
      const parts: TextPart[] = [
        { text: actorName, emphasis: true },
        { text: " created this group with " },
      ];
      for (const [index, member] of rest.entries()) {
        parts.push({ text: member, emphasis: true });
        parts.push({ text: index === rest.length - 1 ? " & " : ", " });
      }
      parts.push({ text: last, emphasis: true });
      parts.push({ text: "." });
      return parts;
    }
    case "member_added":
      if (event.actorDid === event.member) {
        return [
          { text: displayName(event.member, selfDid), emphasis: true },
          { text: " joined the group." },
        ];
      }
      return [
        { text: actorName, emphasis: true },
        { text: " added " },
        { text: displayName(event.member, selfDid), emphasis: true },
        { text: " to the group." },
      ];
    case "member_removed":
      if (event.actorDid === event.member) {
        return [
          { text: displayName(event.member, selfDid), emphasis: true },
          { text: " left the group." },
        ];
      }
      return [
        { text: actorName, emphasis: true },
        { text: " removed " },
        { text: displayName(event.member, selfDid), emphasis: true },
        { text: " from the group." },
      ];
    case "group_icon_changed":
      return [
        { text: actorName, emphasis: true },
        { text: " changed the group icon." },
      ];
    case "group_name_changed":
      return [
        { text: actorName, emphasis: true },
        { text: " changed the group name." },
      ];
  }
}

type Props = {
  event: SystemTimelineEvent;
  identity?: string;
};

export function SystemEventBubble({ event, identity }: Props) {
  useSyncExternalStore(subscribePeerNames, getPeerNamesRevision, () => 0);
  const Icon = icons[event.variant];
  const parts = eventParts(event, identity);

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
