/**
 * Internal barrel for the CO SDK gap layer.
 *
 * Layers:
 * - **Identity** — did:key + LocalMembership (my relationship to a CO)
 * - **CO** — collaboration container (session, tip, resolve root)
 * - **Core** — named data models inside a CO (actions, core tip / state)
 *
 * App / messenger / component code must import from `@/lib/co-sdk/identity`, `@/lib/co-sdk/co`, or
 * `@/lib/co-sdk/core` — not from this file. Only modules under `co-sdk/` may import
 * `@1io/tauri-plugin-co-sdk` directly. Messenger domain logic stays in
 * `src/lib/messenger/`.
 */

export {
  LOCAL_MEMBERSHIP_CORE,
  type Did,
  type LocalMembership,
  type LocalMemberships,
  LocalMembershipState,
  type LocalMembershipAction,
  type KeystoreKey,
  createIdentity,
  useIdentity,
} from "./identity";

export {
  isTauriRuntimeAvailable,
  getCoTip,
  resolveCid,
  createCo,
  getSharedCoSession,
  invalidateSharedCoSession,
  listenCoState,
  useCoSession,
  useCoTip,
  useResolveCid,
  useCo,
  Room,
  errorDetail,
  type CoErrorType,
  type FormattedCoError,
  CoOperationError,
  formatCoError,
} from "./co";

export {
  pushAction,
  getActions,
  useCoreTip,
  useCore,
  DagList,
} from "./core";
