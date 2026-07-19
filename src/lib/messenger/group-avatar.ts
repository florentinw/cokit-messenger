import groupAvatarUrl from "./group-avatar.svg?url";

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

const STORAGE_PREFIX = "co-messenger.group-avatar-color:";

function colorKey(coId: string): string {
  return `${STORAGE_PREFIX}${coId}`;
}

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

/** Local cache of avatar color (survives before ChatStore / CO tags hydrate). */
export function readGroupAvatarColor(coId: string): GroupAvatarColor {
  try {
    const stored = localStorage.getItem(colorKey(coId));
    if (stored && isGroupAvatarColor(stored)) return stored;
  } catch {
    // ignore
  }
  return defaultGroupAvatarColor(coId);
}

export function writeGroupAvatarColor(coId: string, color: string): void {
  if (!isGroupAvatarColor(color)) return;
  try {
    localStorage.setItem(colorKey(coId), color);
  } catch {
    // ignore quota / private mode
  }
}
