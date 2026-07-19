/** Messenger / room-core domain types. */

import type { Room } from "@/lib/co-sdk/co";

/** Built-in CO container core (tags + CoMember wire actions). */
export const CO_CORE = "co";

/** Messaging / timeline core name. */
export const ROOM_CORE = "room";

/** CO tag key for the group display name (copied into DidComm invite payloads). */
export const CO_TAG_GROUP_NAME = "name";

/** CO tag key for the group avatar background color (synced across members). */
export const CO_TAG_GROUP_AVATAR_COLOR = "avatar_color";

/**
 * CO tag key prefix for a member’s display name.
 * Full key is `display_name:<did>` → value is the human name.
 */
export const CO_TAG_DISPLAY_NAME_PREFIX = "display_name:";

/** Invite payload tag: inviter’s display name (string). Fallback before invite metadata. */
export const CO_TAG_INVITER_NAME = "inviter_name";

/** Invite payload tag: inviter’s DID. Fallback before invite metadata. */
export const CO_TAG_INVITER_DID = "inviter_did";

export function displayNameTagKey(did: string): string {
  return `${CO_TAG_DISPLAY_NAME_PREFIX}${did}`;
}

export const IDENTITY_NAME = "messenger-identity";

/** Built-in `co-core-room` WASM/binary CID (from `@1io/tauri-plugin-co-sdk` Cores enum). */
export const ROOM_CORE_BINARY_CID = "QmXzU5G6K8japFjL1uNiqfTCb96mNrDEKcPsGpapQNQKXF";

/** Shown when the UI is opened outside the Tauri desktop window. */
export const TAURI_REQUIRED_MESSAGE =
  "This app must run inside the CO Messenger desktop window (from `pnpm tauri:dev`), not a normal browser tab at http://localhost:1420.";

/** Recovery hint when local CO storage is corrupt or incomplete. */
export const RESET_LOCAL_DATA_HINT =
  "Reset local dev data: stop the app, run `pnpm clear:data`, then `pnpm tauri:dev`.";

/** Room core state — published `Room` schema from co-messaging. */
export type RoomState = Room.Room;

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
