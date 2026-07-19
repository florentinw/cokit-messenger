/**
 * Domain types from the published guest SDK, plus messenger wire helpers.
 */
export {
  CO_CORE_NAME_MEMBERSHIP,
  MembershipState,
  ParticipantState,
  type CoId,
  type Did,
  type GetActionsResponse,
  type Membership,
  type MembershipOptions,
  type Memberships,
  type MembershipsAction,
  type Participant,
  type Tags,
} from "@1io/tauri-plugin-co-sdk";

export type { CoSdkStateEvent } from "@1io/tauri-plugin-co-sdk";

export const CO_CORE_NAME_CO = "co";

/**
 * COKIT stores reducer actions with short CBOR keys (`f`/`t`/`c`/`p`).
 * Some callers may still use the long names (`from`/`time`/`content`/`payload`).
 */
export interface ReducerAction<T> {
  /** Sender DID — wire key `f`. */
  f?: string;
  from?: string;
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
  from: string;
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

export interface KeystoreKey {
  name: string;
  description?: string;
  uri?: string;
}
