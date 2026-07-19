import {
  createCo as sdkCreateCo,
  getActions as sdkGetActions,
  getCoState as sdkGetCoTip,
  pushAction as sdkPushAction,
  resolveCid as sdkResolveCid,
  sessionClose as sdkSessionClose,
  sessionOpen as sdkSessionOpen,
  type GetActionsResponse,
} from "@1io/tauri-plugin-co-sdk";
import type { CID } from "multiformats";
import { CoOperationError, formatCoError } from "../errors";
import { assertTauriRuntime } from "./runtime";

/**
 * Open a CO session for `coId` (requires Tauri).
 * Prefer {@link getSharedCoSession} from app code.
 *
 * @param coId - CO id to open
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
 * Read the current tip CID and heads for a CO.
 *
 * @param coId - CO id (e.g. `"local"` or a group co id)
 * @returns Tuple of `[tipCid | undefined, heads]`
 */
export async function getCoTip(coId: string): Promise<[CID | undefined, CID[]]> {
  assertTauriRuntime();
  return await sdkGetCoTip(coId);
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
 * @returns Action CIDs / paging metadata from the SDK
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
 * Create a new CO owned by `creatorDid`.
 *
 * @param creatorDid - Owner did:key
 * @param coName - Human-readable name for the new CO
 * @param isPublic - Whether the CO is public
 * @param coId - Optional fixed CO id; when omitted the SDK allocates one
 * @returns The new CO id
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
