import {
  createCo as sdkCreateCo,
  getCoState as sdkGetCoTip,
  resolveCid as sdkResolveCid,
  sessionClose as sdkSessionClose,
  sessionOpen as sdkSessionOpen,
} from "@1io/tauri-plugin-co-sdk";
import type { CID } from "multiformats";
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
