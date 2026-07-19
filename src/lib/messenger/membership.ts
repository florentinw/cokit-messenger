import { CID } from "multiformats/cid";
import {
  asDagNode,
  DagList,
  getCoState,
  MembershipState,
  resolveCid,
  type Did,
  type Membership,
} from "../co-sdk-extras";

type DagNode = { n?: unknown[]; l?: unknown[] };

function isCid(value: unknown): value is CID {
  return CID.asCID(value) != null;
}

function isMembership(value: unknown): value is Membership {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as Membership).id === "string"
  );
}

function membershipFromEntry(item: unknown): Membership | undefined {
  if (isMembership(item)) return item;
  if (!Array.isArray(item) || item.length < 2) return undefined;
  const key = item[0];
  const coId = typeof key === "string" ? key : undefined;
  const value = item[1];
  if (value && typeof value === "object") {
    if ("t" in value) return undefined;
    if ("v" in value) {
      const inner = (value as { v?: unknown }).v;
      if (isMembership(inner)) {
        return coId && !inner.id ? { ...inner, id: coId } : inner;
      }
    }
  }
  if (isMembership(value)) {
    return coId && !value.id ? { ...value, id: coId } : value;
  }
  return undefined;
}

function membershipEntriesFromNode(node: unknown): Membership[] {
  if (node == null || typeof node !== "object") return [];
  const dag = node as DagNode;
  const entries: Membership[] = [];
  for (const item of dag.l ?? []) {
    const membership = membershipFromEntry(item);
    if (membership) entries.push(membership);
  }
  return entries;
}

async function membershipEntriesFromDagNode(
  session: string,
  node: unknown,
): Promise<Membership[]> {
  if (node == null) return [];
  if (isCid(node)) return membershipEntriesFromDagNode(session, await resolveCid(session, node));
  if (typeof node !== "object") return membershipEntriesFromNode(node);

  const dag = node as DagNode;
  if (!("n" in dag) && !("l" in dag)) return membershipEntriesFromNode(node);

  const list = new DagList<unknown>(
    asDagNode(dag as { n?: CID[]; l?: unknown[] }),
    session,
  );
  const entries: Membership[] = [];
  for (let index = 0; ; index++) {
    const item = await list.get(index);
    if (item === undefined) break;
    const membership = membershipFromEntry(item);
    if (membership) entries.push(membership);
  }
  return entries;
}

async function membershipEntriesFromCoMapRoot(
  session: string,
  root: unknown,
): Promise<Membership[]> {
  if (root == null) return [];
  if (isCid(root)) return membershipEntriesFromCoMapRoot(session, await resolveCid(session, root));
  if (typeof root !== "object") return [];

  const obj = root as Record<string, unknown>;
  const activeEntries = await membershipEntriesFromDagNode(session, obj.a);
  if (activeEntries.length > 0) return activeEntries;
  return membershipEntriesFromNode(obj.a ?? obj);
}

/** Normalize CO SDK CoMap / DagList membership data to a plain array. */
export function membershipList(raw: unknown): Membership[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter(isMembership);
  if (isCid(raw)) return [];
  if (typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;
  if ("memberships" in obj && !("id" in obj)) {
    return membershipList(obj.memberships);
  }
  if ("a" in obj || ("l" in obj && !("id" in obj))) {
    return membershipEntriesFromNode("a" in obj ? obj.a : obj);
  }
  return Object.values(obj).filter(isMembership);
}

/**
 * Resolve CoMap CID links and walk LSM active nodes — required for real CO storage
 * where `memberships` is a link, not an inline array.
 */
export async function collectMembershipList(
  session: string | undefined,
  raw: unknown,
): Promise<Membership[]> {
  if (raw == null || session === undefined) return [];
  if (Array.isArray(raw)) return raw.filter(isMembership);
  if (isCid(raw)) return membershipEntriesFromCoMapRoot(session, raw);
  if (typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;
  if ("memberships" in obj && !("id" in obj)) {
    return collectMembershipList(session, obj.memberships);
  }
  if ("a" in obj || (("l" in obj || "n" in obj) && !("id" in obj))) {
    return membershipEntriesFromCoMapRoot(session, obj);
  }
  return membershipList(raw);
}

export function membershipStateFor(membership: Membership, did?: Did): MembershipState | undefined {
  if (did !== undefined && membership.did?.[did] !== undefined) return membership.did[did];
  const values = Object.values(membership.did ?? {}) as MembershipState[];
  if (values.length === 0) return undefined;
  return Math.min(...values) as MembershipState;
}

/** Memberships that should appear in the chat sidebar (incl. in-progress joins and invites). */
export function isSidebarMembership(membership: Membership, did?: Did): boolean {
  const state = membershipStateFor(membership, did);
  return (
    state === MembershipState.Active ||
    state === MembershipState.Join ||
    state === MembershipState.Pending ||
    state === MembershipState.Invite
  );
}

export function activeParticipants(membership: Membership): Did[] {
  return Object.entries(membership.did ?? {})
    .filter(([, state]) => state === MembershipState.Active)
    .map(([did]) => did);
}

/**
 * Local membership `did` map only tracks *your* state for a CO.
 * Full roster + pending invitees live on the group CO’s participants list —
 * use `collectActiveParticipantsFromGroup` / `collectPendingInviteesFromGroup`.
 */
export function pendingInvitees(membership: Membership): Did[] {
  return Object.entries(membership.did ?? {})
    .filter(([, state]) => state === MembershipState.Invite)
    .map(([did]) => did);
}

/** COKIT `ParticipantState` (`cores/co` `#[repr(u8)]`). */
const PARTICIPANT_STATE_ACTIVE = 0;
const PARTICIPANT_STATE_INVITE = 2;

type CoParticipant = { did?: string; state?: number };

function participantFromEntry(item: unknown): CoParticipant | undefined {
  if (!Array.isArray(item) || item.length < 2) {
    if (item && typeof item === "object" && "did" in item) return item as CoParticipant;
    return undefined;
  }
  const value = item[1];
  if (value && typeof value === "object") {
    if ("t" in value) return undefined;
    const inner = "v" in value ? (value as { v?: unknown }).v : value;
    if (inner && typeof inner === "object") return inner as CoParticipant;
  }
  return undefined;
}

/** Walk the group CO `p` (participants) DagList. */
async function collectGroupParticipants(
  session: string,
  coId: string,
): Promise<CoParticipant[]> {
  const [stateCid] = await getCoState(coId);
  if (!stateCid) return [];
  const co = (await resolveCid(session, stateCid)) as { p?: unknown };
  if (co.p == null) return [];

  const root = isCid(co.p) ? await resolveCid(session, co.p) : co.p;
  if (root == null || typeof root !== "object") return [];

  const obj = root as Record<string, unknown>;
  const dagRoot = obj.a ?? obj;
  const entries: CoParticipant[] = [];

  if (dagRoot && typeof dagRoot === "object") {
    const dag = dagRoot as DagNode;
    if ("n" in dag || "l" in dag) {
      const list = new DagList<unknown>(
    asDagNode(dag as { n?: CID[]; l?: unknown[] }),
    session,
  );
      for (let index = 0; ; index++) {
        const item = await list.get(index);
        if (item === undefined) break;
        const participant = participantFromEntry(item);
        if (participant) entries.push(participant);
      }
    } else {
      for (const item of (dag as DagNode).l ?? []) {
        const participant = participantFromEntry(item);
        if (participant) entries.push(participant);
      }
    }
  }

  return entries;
}

/**
 * Active members from the group CO participant list.
 * Local membership only tracks *your* state — do not use it for the full roster.
 */
export async function collectActiveParticipantsFromGroup(
  session: string,
  coId: string,
): Promise<Did[]> {
  try {
    const entries = await collectGroupParticipants(session, coId);
    const dids: Did[] = [];
    for (const p of entries) {
      if (p.state === PARTICIPANT_STATE_ACTIVE && typeof p.did === "string") {
        dids.push(p.did);
      }
    }
    return dids;
  } catch {
    return [];
  }
}

/** Invitees still pending on the group CO (inviter’s view after ParticipantInvite). */
export async function collectPendingInviteesFromGroup(
  session: string,
  coId: string,
): Promise<Did[]> {
  try {
    const entries = await collectGroupParticipants(session, coId);
    const dids: Did[] = [];
    for (const p of entries) {
      if (p.state === PARTICIPANT_STATE_INVITE && typeof p.did === "string") {
        dids.push(p.did);
      }
    }
    return dids;
  } catch {
    return [];
  }
}

