import {
  getActions as sdkGetActions,
  pushAction as sdkPushAction,
  type GetActionsResponse,
} from "@1io/tauri-plugin-co-sdk";
import type { CID } from "multiformats";
import { CoOperationError, formatCoError } from "../errors";
import { assertTauriRuntime } from "../co/runtime";

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
