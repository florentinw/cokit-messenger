/**
 * App-level additions on top of the published packages. We use this as the
 * single source of truth for the repo to track what’s missing in the COKIT SDK.
 *
 * Import CO SDK types, invoke helpers, and shared hooks from here — not from
 * `@1io/tauri-plugin-co-sdk` directly. Messenger domain logic stays in
 * `src/lib/messenger/`.
 */

export {
  CO_CORE_NAME_MEMBERSHIP,
  MembershipState,
  type Did,
  type Membership,
  type Memberships,
  type MembershipsAction,
  Room,
  type KeystoreKey,
} from "./types";

export {
  errorDetail,
  type CoErrorType,
  type FormattedCoError,
  CoOperationError,
  formatCoError,
} from "./errors";

export {
  isTauriRuntimeAvailable,
  getCoState,
  pushAction,
  resolveCid,
  getActions,
  createIdentity,
  createCo,
} from "./invoke";

export {
  useCoSession,
  useCo,
  useCoreTipCid,
  useResolveCid,
  useDidKeyIdentity,
} from "./hooks";

export { getSharedCoSession, invalidateSharedCoSession } from "./session-cache";

export { DagList } from "./dag-list";

export { listenCoSdkState } from "./state-listener";
