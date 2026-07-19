/**
 * App-level additions on top of the published packages. We use this as the
 * single source of truth for the repo to track what’s missing in the COKIT SDK.
 *
 * Layers:
 * - **Identity** — did:key + LocalMembership (my relationship to a CO)
 * - **CO** — collaboration container (session, tip, resolve root)
 * - **Core** — named data models inside a CO (actions, core tip / state)
 *
 * Import from here — not from `@1io/tauri-plugin-co-sdk` directly.
 * Messenger domain logic stays in `src/lib/messenger/`.
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
} from "./co";

export {
  pushAction,
  getActions,
  useCoreTip,
  useCore,
  DagList,
} from "./core";

export {
  errorDetail,
  type CoErrorType,
  type FormattedCoError,
  CoOperationError,
  formatCoError,
} from "./errors";
