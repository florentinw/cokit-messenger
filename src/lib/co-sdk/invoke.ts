import { decode, encode } from "@ipld/dag-cbor";
import { invoke as tauriInvoke, isTauri } from "@tauri-apps/api/core";
import { CID } from "multiformats";
import { isMockCoEnabled, mockStore } from "./mock";
import type { GetActionsResponse } from "./types";

export const TAURI_REQUIRED_MESSAGE =
  "This app must run inside the CoKit Messenger desktop window (from `pnpm tauri:dev`), not a normal browser tab at http://localhost:1420.";

export function isTauriRuntimeAvailable(): boolean {
  if (isMockCoEnabled()) return true;
  return (
    isTauri() &&
    typeof (window as Window & { __TAURI_INTERNALS__?: { invoke?: unknown } })
      .__TAURI_INTERNALS__?.invoke === "function"
  );
}

async function invoke<T>(
  cmd: string,
  args?: unknown,
  options?: Parameters<typeof tauriInvoke>[2],
): Promise<T> {
  if (!isTauriRuntimeAvailable()) {
    throw new Error(TAURI_REQUIRED_MESSAGE);
  }
  return tauriInvoke<T>(cmd, args as never, options);
}

export async function sessionOpen(coId: string): Promise<string> {
  if (isMockCoEnabled()) return mockStore.sessionOpen(coId);
  return await invoke("plugin:co-sdk|session_open", { coId });
}

export async function sessionClose(sessionId: string) {
  if (isMockCoEnabled()) {
    mockStore.sessionClose(sessionId);
    return;
  }
  await invoke("plugin:co-sdk|session_close", { sessionId });
}

export async function getCoState(co: string): Promise<[CID | undefined, CID[]]> {
  if (isMockCoEnabled()) return mockStore.getCoState(co);
  const result = await invoke<ArrayBuffer>("plugin:co-sdk|get_co_state", { co });
  return decode<[CID | undefined, CID[]]>(result);
}

export async function pushAction(
  session: string,
  core: string,
  action: unknown,
  identity: string,
): Promise<CID | undefined> {
  if (isMockCoEnabled()) {
    return mockStore.pushAction(session, core, action, identity);
  }
  const body = encode({ session, core, action, identity });
  const result = await invoke<ArrayBuffer>("plugin:co-sdk|push_action", body);
  return decode<CID | undefined>(result);
}

export async function resolveCid(session: string, cid: CID): Promise<unknown> {
  if (isMockCoEnabled()) return mockStore.resolveCid(session, cid);
  const body = encode({ session, cid });
  const result = await invoke<ArrayBuffer>("plugin:co-sdk|resolve_cid", body);
  return decode(result);
}

export async function getActions(
  session: string,
  heads: CID[],
  count: number,
  until: CID | undefined,
): Promise<GetActionsResponse> {
  if (isMockCoEnabled()) return mockStore.getActions(session, heads, count, until);
  const body =
    until !== undefined
      ? encode({ session, heads, count, until })
      : encode({ session, heads, count, until: null });
  const result = await invoke<ArrayBuffer>("plugin:co-sdk|get_actions", body);
  return decode(result);
}

export async function createIdentity(name: string, seed?: Uint8Array): Promise<string> {
  if (isMockCoEnabled()) return mockStore.createIdentity(name);
  return await invoke("plugin:co-sdk|create_identity", {
    name,
    seed: seed ? Array.from(seed) : undefined,
  });
}

export async function createCo(
  creatorDid: string,
  coName: string,
  isPublic: boolean,
  coId?: string,
): Promise<string> {
  if (isMockCoEnabled()) return mockStore.createCo(creatorDid, coName, isPublic, coId);
  return await invoke("plugin:co-sdk|create_co", {
    creatorDid,
    coId,
    coName,
    public: isPublic,
  });
}

export { isMockCoEnabled } from "./mock";
