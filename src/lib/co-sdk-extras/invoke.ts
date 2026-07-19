import {
  createCo as sdkCreateCo,
  createIdentity as sdkCreateIdentity,
  getActions as sdkGetActions,
  getCoState as sdkGetCoState,
  pushAction as sdkPushAction,
  resolveCid as sdkResolveCid,
  sessionClose as sdkSessionClose,
  sessionOpen as sdkSessionOpen,
  type GetActionsResponse,
} from "@1io/tauri-plugin-co-sdk";
import { isTauri } from "@tauri-apps/api/core";
import type { CID } from "multiformats";
import { CoOperationError, formatCoError } from "./errors";

/** Thrown when IPC is invoked outside a Tauri webview (not exported — UI copy lives in messenger). */
const TAURI_REQUIRED_MESSAGE =
  "This app must run inside a Tauri desktop window, not a normal browser tab.";

/** Set after the first successful Tauri check so later IPC skips the probe. */
let tauriRuntimeReady = false;

/**
 * True when the page is running under Tauri with a working `invoke` bridge.
 *
 * @returns `true` if Tauri + `__TAURI_INTERNALS__.invoke` are available
 */
export function isTauriRuntimeAvailable(): boolean {
  return (
    isTauri() &&
    typeof (window as Window & { __TAURI_INTERNALS__?: { invoke?: unknown } })
      .__TAURI_INTERNALS__?.invoke === "function"
  );
}

function assertTauriRuntime() {
  if (tauriRuntimeReady) return;
  if (!isTauriRuntimeAvailable()) {
    throw new Error(TAURI_REQUIRED_MESSAGE);
  }
  tauriRuntimeReady = true;
}

/**
 * Open a CO session for `coId` (requires Tauri).
 * Prefer {@link getSharedCoSession} from app code.
 *
 * @param coId - CO document id to open
 * @returns Session id string for subsequent invoke calls
 */
export async function sessionOpen(coId: string): Promise<string> {
  assertTauriRuntime();
  return await sdkSessionOpen(coId);
}

/**
 * Close an open CO session.
 * Prefer {@link invalidateSharedCoSession} from app code.
 *
 * @param sessionId - Session id from {@link sessionOpen} / {@link getSharedCoSession}
 * @returns Resolves when the session has been closed
 */
export async function sessionClose(sessionId: string): Promise<void> {
  assertTauriRuntime();
  await sdkSessionClose(sessionId);
}

/**
 * Read the current tip CID and heads for a CO document.
 *
 * @param co - CO document id (e.g. `"local"` or a group co id)
 * @returns Tuple of `[tipCid | undefined, heads]`
 */
export async function getCoState(co: string): Promise<[CID | undefined, CID[]]> {
  assertTauriRuntime();
  return await sdkGetCoState(co);
}

/**
 * Push a reducer action onto a named core.
 * Wraps SDK failures in {@link CoOperationError}.
 *
 * @param session - Open session id
 * @param core - Core name to push onto (e.g. `"membership"`, `"room"`, `"co"`)
 * @param action - Reducer action payload (shape depends on the core)
 * @param identity - Signing did:key identity
 * @returns CID of the new tip when the SDK returns one; otherwise `undefined`
 */
export async function pushAction(
  session: string,
  core: string,
  action: unknown,
  identity: string,
): Promise<CID | undefined> {
  assertTauriRuntime();
  try {
    return await sdkPushAction(session, core, action, identity);
  } catch (err) {
    throw new CoOperationError(formatCoError(err));
  }
}

/**
 * Resolve a CID to its decoded DAG value via the open session.
 *
 * @param session - Open session id
 * @param cid - Content id to resolve
 * @returns Decoded IPLD / CBOR value for that CID
 */
export async function resolveCid(session: string, cid: CID): Promise<unknown> {
  assertTauriRuntime();
  return await sdkResolveCid(session, cid);
}

/**
 * Page reducer actions from `heads`, stopping at `until` when set.
 *
 * @param session - Open session id
 * @param heads - Head CIDs to walk from
 * @param count - Maximum number of actions to return
 * @param until - Optional CID to stop before (exclusive); pass `undefined` for no bound
 * @returns {@link GetActionsResponse} with action CIDs / paging metadata from the SDK
 */
export async function getActions(
  session: string,
  heads: CID[],
  count: number,
  until: CID | undefined,
): Promise<GetActionsResponse> {
  assertTauriRuntime();
  return await sdkGetActions(session, heads, count, until);
}

/**
 * Create (or return) a named did:key identity in the local keystore.
 *
 * @param name - Keystore entry name (e.g. `"messenger-identity"`)
 * @param seed - Optional entropy for deterministic key generation
 * @returns did:key string for the identity
 */
export async function createIdentity(name: string, seed?: Uint8Array): Promise<string> {
  assertTauriRuntime();
  return await sdkCreateIdentity(name, seed);
}

/**
 * Create a new CO document owned by `creatorDid`.
 *
 * @param creatorDid - Owner did:key
 * @param coName - Human-readable name for the new CO
 * @param isPublic - Whether the CO is public
 * @param coId - Optional fixed CO id; when omitted the SDK allocates one
 * @returns The new CO document id
 */
export async function createCo(
  creatorDid: string,
  coName: string,
  isPublic: boolean,
  coId?: string,
): Promise<string> {
  assertTauriRuntime();
  return await sdkCreateCo(creatorDid, coName, isPublic, coId);
}
