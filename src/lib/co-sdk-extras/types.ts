/**
 * Domain types from `@1io/tauri-plugin-co-sdk`, plus keystore helpers used by
 * the shared identity hook.
 *
 * App code outside `co-sdk-extras/` must import these from here — never from
 * `@1io/tauri-plugin-co-sdk` directly. This folder tracks gaps vs the COKIT SDK.
 */

export {
  CO_CORE_NAME_MEMBERSHIP,
  MembershipState,
  type Did,
  type Membership,
  type Memberships,
  type MembershipsAction,
  Room,
} from "@1io/tauri-plugin-co-sdk";

/** Keystore entry value stored under the local CO `keystore` core. */
export interface KeystoreKey {
  /** Display / lookup name for the key (e.g. `"messenger-identity"`). */
  name: string;
  /** Optional human-readable description. */
  description?: string;
  /** Optional URI associated with the key entry. */
  uri?: string;
}
