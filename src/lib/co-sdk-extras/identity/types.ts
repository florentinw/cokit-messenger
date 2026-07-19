/**
 * Identity types: did:key + LocalMembership (my relationship to a CO).
 *
 * App code must import these from `co-sdk-extras` — never from
 * `@1io/tauri-plugin-co-sdk` directly.
 */

import {
  CO_CORE_NAME_MEMBERSHIP as LOCAL_MEMBERSHIP_CORE,
  MembershipState as SdkMembershipState,
  type Did,
  type Membership,
  type Memberships,
  type MembershipsAction,
} from "@1io/tauri-plugin-co-sdk";

export { LOCAL_MEMBERSHIP_CORE, type Did };

/** My relationship to a CO id (local bookmark). Not the CO member list. */
export type LocalMembership = Membership;

/** Local membership list wrapper from the membership core. */
export type LocalMemberships = Memberships;

/** Per-DID status on a {@link LocalMembership} row. */
export const LocalMembershipState = SdkMembershipState;
export type LocalMembershipState = SdkMembershipState;

/** Actions pushed to the local membership core. */
export type LocalMembershipAction = MembershipsAction;

/** Keystore entry value stored under the local CO `keystore` core. */
export interface KeystoreKey {
  /** Display / lookup name for the key (e.g. `"messenger-identity"`). */
  name: string;
  /** Optional human-readable description. */
  description?: string;
  /** Optional URI associated with the key entry. */
  uri?: string;
}
