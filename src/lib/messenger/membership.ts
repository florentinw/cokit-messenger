import { CID } from "multiformats/cid";
import {
  LocalMembershipState,
  type Did,
  type LocalMembership,
} from "@/lib/co-sdk/identity";
import { getCoTip, resolveCid } from "@/lib/co-sdk/co";
import { DagList } from "@/lib/co-sdk/core";

type DagNode = { n?: CID[]; l?: unknown[] };

function isCid(value: unknown): value is CID {
  return CID.asCID(value) != null;
}

function isLocalMembership(value: unknown): value is LocalMembership {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as LocalMembership).id === "string"
  );
}

function localMembershipFromEntry(item: unknown): LocalMembership | undefined {
  if (isLocalMembership(item)) return item;
  if (!Array.isArray(item) || item.length < 2) return undefined;
  const key = item[0];
  const coId = typeof key === "string" ? key : undefined;
  const value = item[1];
  if (value && typeof value === "object") {
    if ("t" in value) return undefined;
    if ("v" in value) {
      const inner = (value as { v?: unknown }).v;
      if (isLocalMembership(inner)) {
        return coId && !inner.id ? { ...inner, id: coId } : inner;
      }
    }
  }
  if (isLocalMembership(value)) {
    return coId && !value.id ? { ...value, id: coId } : value;
  }
  return undefined;
}

/**
 * Walk an LSM DagList (or inline leaf list), mapping each entry.
 * Shared by LocalMembership CoMap walks and CoMembers walks.
 */
async function walkDagListEntries<T>(
  session: string,
  root: unknown,
  mapEntry: (item: unknown) => T | undefined,
): Promise<T[]> {
  if (root == null) return [];
  if (isCid(root)) return walkDagListEntries(session, await resolveCid(session, root), mapEntry);
  if (typeof root !== "object") return [];

  const dag = root as DagNode;
  const entries: T[] = [];

  if ("n" in dag || "l" in dag) {
    try {
      const list = new DagList<unknown>({ n: dag.n, l: dag.l }, session);
      for (let index = 0; ; index++) {
        const item = await list.get(index);
        if (item === undefined) break;
        const mapped = mapEntry(item);
        if (mapped !== undefined) entries.push(mapped);
      }
      if (entries.length > 0) return entries;
    } catch {
      // fall through to inline leaves
    }
    for (const item of dag.l ?? []) {
      const mapped = mapEntry(item);
      if (mapped !== undefined) entries.push(mapped);
    }
  }

  return entries;
}

function localMembershipEntriesFromNode(node: unknown): LocalMembership[] {
  if (node == null || typeof node !== "object") return [];
  const dag = node as DagNode;
  const entries: LocalMembership[] = [];
  for (const item of dag.l ?? []) {
    const membership = localMembershipFromEntry(item);
    if (membership) entries.push(membership);
  }
  return entries;
}

async function localMembershipEntriesFromCoMapRoot(
  session: string,
  root: unknown,
): Promise<LocalMembership[]> {
  if (root == null) return [];
  if (isCid(root)) {
    return localMembershipEntriesFromCoMapRoot(session, await resolveCid(session, root));
  }
  if (typeof root !== "object") return [];

  const obj = root as Record<string, unknown>;
  const activeEntries = await walkDagListEntries(session, obj.a, localMembershipFromEntry);
  if (activeEntries.length > 0) return activeEntries;
  return localMembershipEntriesFromNode(obj.a ?? obj);
}

/** Normalize CO SDK CoMap / DagList LocalMembership data to a plain array. */
function localMembershipList(raw: unknown): LocalMembership[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter(isLocalMembership);
  if (isCid(raw)) return [];
  if (typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;
  if ("memberships" in obj && !("id" in obj)) {
    return localMembershipList(obj.memberships);
  }
  if ("a" in obj || ("l" in obj && !("id" in obj))) {
    return localMembershipEntriesFromNode("a" in obj ? obj.a : obj);
  }
  return Object.values(obj).filter(isLocalMembership);
}

/**
 * Resolve CoMap CID links and walk LSM active nodes — required for real CO storage
 * where `memberships` is a link, not an inline array.
 */
export async function collectLocalMemberships(
  session: string | undefined,
  raw: unknown,
): Promise<LocalMembership[]> {
  if (raw == null || session === undefined) return [];
  if (Array.isArray(raw)) return raw.filter(isLocalMembership);
  if (isCid(raw)) return localMembershipEntriesFromCoMapRoot(session, raw);
  if (typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;
  if ("memberships" in obj && !("id" in obj)) {
    return collectLocalMemberships(session, obj.memberships);
  }
  if ("a" in obj || (("l" in obj || "n" in obj) && !("id" in obj))) {
    return localMembershipEntriesFromCoMapRoot(session, obj);
  }
  return localMembershipList(raw);
}

export function localMembershipStateFor(
  membership: LocalMembership,
  did?: Did,
): LocalMembershipState | undefined {
  if (did !== undefined && membership.did?.[did] !== undefined) return membership.did[did];
  const values = Object.values(membership.did ?? {}) as LocalMembershipState[];
  if (values.length === 0) return undefined;
  return Math.min(...values) as LocalMembershipState;
}

/** Local memberships that should appear in the chat sidebar (incl. in-progress joins and invites). */
export function isSidebarMembership(membership: LocalMembership, did?: Did): boolean {
  const state = localMembershipStateFor(membership, did);
  return (
    state === LocalMembershipState.Active ||
    state === LocalMembershipState.Join ||
    state === LocalMembershipState.Pending ||
    state === LocalMembershipState.Invite
  );
}

/** Active dids from a LocalMembership row’s `did` map (not the CO member roster). */
export function activeDidsFromLocalMembership(membership: LocalMembership): Did[] {
  return Object.entries(membership.did ?? {})
    .filter(([, state]) => state === LocalMembershipState.Active)
    .map(([did]) => did);
}

/**
 * Wire CoMember row on the group CO `p` map.
 * State is a Rust `#[repr(u8)]` (not the TS string enum): Active = 0, Invite = 2.
 */
const CO_MEMBER_STATE_ACTIVE = 0;
const CO_MEMBER_STATE_INVITE = 2;

type WireCoMember = { did?: string; state?: number };

function coMemberFromEntry(item: unknown): WireCoMember | undefined {
  if (!Array.isArray(item) || item.length < 2) {
    if (item && typeof item === "object" && "did" in item) return item as WireCoMember;
    return undefined;
  }
  const value = item[1];
  if (value && typeof value === "object") {
    if ("t" in value) return undefined;
    const inner = "v" in value ? (value as { v?: unknown }).v : value;
    if (inner && typeof inner === "object") return inner as WireCoMember;
  }
  return undefined;
}

/** Walk the group CO `p` (CoMembers) DagList once. */
async function collectWireCoMembers(
  session: string,
  coId: string,
): Promise<WireCoMember[]> {
  const [stateCid] = await getCoTip(coId);
  if (!stateCid) return [];
  const co = (await resolveCid(session, stateCid)) as { p?: unknown };
  if (co.p == null) return [];

  const root = isCid(co.p) ? await resolveCid(session, co.p) : co.p;
  if (root == null || typeof root !== "object") return [];

  const obj = root as Record<string, unknown>;
  return walkDagListEntries(session, obj.a ?? obj, coMemberFromEntry);
}

/** People on a CO: active members + pending invitees. */
export type CoMembers = {
  active: Did[];
  pending: Did[];
};

/**
 * Active members + pending invitees from the group CO member list (one walk).
 * LocalMembership only tracks *your* state — do not use it for the full roster.
 */
export async function collectCoMembers(
  session: string,
  coId: string,
): Promise<CoMembers> {
  try {
    const entries = await collectWireCoMembers(session, coId);
    const active: Did[] = [];
    const pending: Did[] = [];
    for (const p of entries) {
      if (typeof p.did !== "string") continue;
      if (p.state === CO_MEMBER_STATE_ACTIVE) active.push(p.did);
      else if (p.state === CO_MEMBER_STATE_INVITE) pending.push(p.did);
    }
    return { active, pending };
  } catch {
    return { active: [], pending: [] };
  }
}
