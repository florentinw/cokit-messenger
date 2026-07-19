import groupAvatarUrl from "@/lib/messenger/group-avatar.svg?url";

export const GROUP_AVATAR_SRC = groupAvatarUrl;

/** Soft, distinct backgrounds for the group avatar mark. */
export const GROUP_AVATAR_COLORS = [
  "#888888",
  "#00745F",
  "#267BDF",
  "#612BA5",
  "#F56335",
] as const;

export type GroupAvatarColor = (typeof GROUP_AVATAR_COLORS)[number];

export const DEFAULT_GROUP_AVATAR_COLOR: GroupAvatarColor = "#267BDF";

export function isGroupAvatarColor(value: string): value is GroupAvatarColor {
  return (GROUP_AVATAR_COLORS as readonly string[]).includes(value);
}

/** Deterministic default when no color is in ChatStore yet. */
export function defaultGroupAvatarColor(coId: string): GroupAvatarColor {
  let hash = 0;
  for (let i = 0; i < coId.length; i++) {
    hash = (hash + coId.charCodeAt(i) * 17) % GROUP_AVATAR_COLORS.length;
  }
  return GROUP_AVATAR_COLORS[hash] ?? DEFAULT_GROUP_AVATAR_COLOR;
}
