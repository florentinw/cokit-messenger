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

export const TAURI_REQUIRED_MESSAGE =
  "This app must run inside the CO Messenger desktop window (from `pnpm tauri:dev`), not a normal browser tab at http://localhost:1420.";

export function isTauriRuntimeAvailable(): boolean {
  return (
    isTauri() &&
    typeof (window as Window & { __TAURI_INTERNALS__?: { invoke?: unknown } })
      .__TAURI_INTERNALS__?.invoke === "function"
  );
}

function assertTauriRuntime() {
  if (!isTauriRuntimeAvailable()) {
    throw new Error(TAURI_REQUIRED_MESSAGE);
  }
}

export async function sessionOpen(coId: string): Promise<string> {
  assertTauriRuntime();
  return await sdkSessionOpen(coId);
}

export async function sessionClose(sessionId: string) {
  assertTauriRuntime();
  await sdkSessionClose(sessionId);
}

export async function getCoState(co: string): Promise<[CID | undefined, CID[]]> {
  assertTauriRuntime();
  return await sdkGetCoState(co);
}

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

export async function resolveCid(session: string, cid: CID): Promise<unknown> {
  assertTauriRuntime();
  return await sdkResolveCid(session, cid);
}

export async function getActions(
  session: string,
  heads: CID[],
  count: number,
  until: CID | undefined,
): Promise<GetActionsResponse> {
  assertTauriRuntime();
  return await sdkGetActions(session, heads, count, until);
}

export async function createIdentity(name: string, seed?: Uint8Array): Promise<string> {
  assertTauriRuntime();
  return await sdkCreateIdentity(name, seed);
}

export async function createCo(
  creatorDid: string,
  coName: string,
  isPublic: boolean,
  coId?: string,
): Promise<string> {
  assertTauriRuntime();
  return await sdkCreateCo(creatorDid, coName, isPublic, coId);
}
