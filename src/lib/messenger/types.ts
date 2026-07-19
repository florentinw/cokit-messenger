/** Messenger / room-core domain types (not part of the generic COKIT guest SDK). */

export const CO_CORE_NAME_ROOM = "room";

/** CO tag key for the group display name (copied into DidComm invite payloads). */
export const CO_TAG_GROUP_NAME = "name";

/** CO tag key for the group avatar background color (synced across members). */
export const CO_TAG_GROUP_AVATAR_COLOR = "avatar_color";

/**
 * CO tag key prefix for a member’s display name.
 * Full key is `display_name:<did>` → value is the human name.
 */
export const CO_TAG_DISPLAY_NAME_PREFIX = "display_name:";

/** Invite payload tag: inviter’s display name (string). */
export const CO_TAG_INVITER_NAME = "inviter_name";

/** Invite payload tag: inviter’s DID. */
export const CO_TAG_INVITER_DID = "inviter_did";

export function displayNameTagKey(did: string): string {
  return `${CO_TAG_DISPLAY_NAME_PREFIX}${did}`;
}

export const IDENTITY_NAME = "messenger-identity";

export const ROOM_CORE_CID = "QmXzU5G6K8japFjL1uNiqfTCb96mNrDEKcPsGpapQNQKXF";

export interface RoomState {
  name: string;
  description: string;
  avatar?: { "/": string } | null;
  pinned_messages: string[];
}

export type TextMessageContent = {
  msgtype: "text";
  body: string;
};

export type RoomSystemEvent =
  | { variant: "group_created"; members: string[] }
  | { variant: "member_added"; member: string }
  | { variant: "member_removed"; member: string }
  | { variant: "group_icon_changed" }
  | { variant: "group_name_changed" };

export type MatrixEvent = {
  event_id: string;
  room_id: string;
  timestamp: number;
  state_key?: string | null;
} & (
  | { type: "m_room_message"; content: TextMessageContent }
  | { type: "room_name"; content: { name: string } }
  | { type: "m.room.system"; content: RoomSystemEvent }
);
