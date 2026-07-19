import type { CID } from "multiformats";

export type CoId = string;
export type Did = string;

export enum MembershipState {
  Active = 10,
  Pending = 15,
  Join = 20,
  Invite = 30,
  Inactive = 40,
}

export interface Membership {
  id: CoId;
  did: Record<Did, MembershipState>;
  state?: unknown;
  key?: string;
  tags?: unknown;
}

export interface Memberships {
  memberships: Membership[];
}

export type MembershipsAction =
  | { Join: { id: CoId; did: Did } }
  | { InviteAccept: { id: CoId; did: Did } }
  | { Invited: { id: CoId; did: Did } }
  | { Deactivate: { id: CoId; did: Did } }
  | { Remove: { id: CoId; did?: Did } };

export const CO_CORE_NAME_MEMBERSHIP = "membership";
export const CO_CORE_NAME_ROOM = "room";
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

export type MatrixEvent = {
  event_id: string;
  room_id: string;
  timestamp: number;
  state_key?: string | null;
} & (
  | { type: "m_room_message"; content: TextMessageContent }
  | { type: "room_name"; content: { name: string } }
);

export interface ReducerAction<T> {
  from: Did;
  payload: T;
  time?: number;
}

export interface GetActionsResponse {
  actions: CID[];
  next_heads: CID[];
}

export type CoSdkStateEvent = [string, CID | undefined, CID[]];

export interface KeystoreKey {
  name: string;
  description?: string;
  uri?: string;
}
