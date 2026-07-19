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

export const CO_CORE_NAME_CO = "co";
export const CO_CORE_NAME_MEMBERSHIP = "membership";

/**
 * COKIT stores reducer actions with short CBOR keys (`f`/`t`/`c`/`p`).
 * Some callers may still use the long names (`from`/`time`/`content`/`payload`).
 */
export interface ReducerAction<T> {
  /** Sender DID — wire key `f`. */
  f?: Did;
  from?: Did;
  /** Dispatch time — wire key `t`. */
  t?: number;
  time?: number;
  /** Core name — wire key `c`. */
  c?: string;
  core?: string;
  /** Action payload — wire key `p`. */
  p?: T;
  payload?: T;
}

export function reducerActionFrom<T>(action: ReducerAction<T> | unknown): {
  from: Did;
  time: number | undefined;
  core: string | undefined;
  payload: T | undefined;
} {
  const raw = action as ReducerAction<T>;
  return {
    from: raw.f ?? raw.from ?? "unknown",
    time: raw.t ?? raw.time,
    core: raw.c ?? raw.core,
    payload: raw.p ?? raw.payload,
  };
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
