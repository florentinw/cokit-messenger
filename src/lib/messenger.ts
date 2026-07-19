import { CID } from "multiformats/cid";
import { v4 as uuid } from "uuid";
import {
  CO_CORE_NAME_MEMBERSHIP,
  CO_CORE_NAME_ROOM,
  createCo,
  DagList,
  MembershipState,
  pushAction,
  resolveCid,
  ROOM_CORE_CID,
  sessionClose,
  sessionOpen,
  type Did,
  type MatrixEvent,
  type Membership,
  type MembershipsAction,
  type ReducerAction,
} from "./co-sdk";

const AVATARS = [
  "/avatars/butterfly.svg",
  "/avatars/fish.svg",
  "/avatars/butterfly-alt.svg",
] as const;

export function avatarForCo(coId: string): string {
  let hash = 0;
  for (let i = 0; i < coId.length; i++) hash = (hash + coId.charCodeAt(i)) % AVATARS.length;
  return AVATARS[hash] ?? AVATARS[0];
}

export function truncateDid(did: string, max = 22): string {
  if (did.length <= max) return did;
  return `${did.slice(0, max - 1)}…`;
}

export function formatChatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function dateChipLabel(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (startOfMsg === startOfToday) return "Today";
  if (startOfMsg === startOfToday - 86_400_000) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

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

  const list = new DagList<unknown>(dag as { n?: CID[]; l?: unknown[] }, session);
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

/** Normalize CO SDK CoMap / DagList membership data to a plain array (sync, mock/plain arrays). */
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

export function isActiveMembership(membership: Membership, did?: Did): boolean {
  const state = membershipStateFor(membership, did);
  return state === MembershipState.Active;
}

/** Memberships that should appear in the chat sidebar (incl. in-progress joins). */
export function isSidebarMembership(membership: Membership, did?: Did): boolean {
  const state = membershipStateFor(membership, did);
  return (
    state === MembershipState.Active ||
    state === MembershipState.Join ||
    state === MembershipState.Pending
  );
}

export async function createGroupChat(identity: Did, name: string): Promise<string> {
  const coId = await createCo(identity, name, false);
  const session = await sessionOpen(coId);
  try {
    await ensureRoomCore(session, identity);
    await setRoomName(session, identity, coId, name);
  } finally {
    await sessionClose(session);
  }
  return coId;
}

export async function ensureRoomCore(session: string, identity: Did): Promise<void> {
  const binary = CID.parse(ROOM_CORE_CID);
  await pushAction(
    session,
    "co",
    {
      CoreCreate: {
        core: CO_CORE_NAME_ROOM,
        binary,
        tags: [["type", "room"]],
      },
    },
    identity,
  );
}

export async function setRoomName(
  session: string,
  identity: Did,
  roomId: string,
  name: string,
): Promise<void> {
  const event: MatrixEvent = {
    event_id: uuid(),
    room_id: roomId,
    timestamp: Date.now(),
    type: "room_name",
    content: { name },
  };
  await pushAction(session, CO_CORE_NAME_ROOM, event, identity);
}

export async function sendTextMessage(
  session: string,
  identity: Did,
  roomId: string,
  body: string,
): Promise<void> {
  const event: MatrixEvent = {
    event_id: uuid(),
    room_id: roomId,
    timestamp: Date.now(),
    type: "m_room_message",
    content: { msgtype: "text", body },
  };
  await pushAction(session, CO_CORE_NAME_ROOM, event, identity);
}

export async function joinMembership(
  localSession: string,
  identity: Did,
  coId: string,
): Promise<void> {
  const action: MembershipsAction = { Join: { id: coId, did: identity } };
  await pushAction(localSession, CO_CORE_NAME_MEMBERSHIP, action, identity);
}

export async function acceptInvite(
  localSession: string,
  identity: Did,
  coId: string,
): Promise<void> {
  const action: MembershipsAction = { InviteAccept: { id: coId, did: identity } };
  await pushAction(localSession, CO_CORE_NAME_MEMBERSHIP, action, identity);
}

export async function leaveMembership(
  localSession: string,
  identity: Did,
  coId: string,
): Promise<void> {
  const action: MembershipsAction = { Deactivate: { id: coId, did: identity } };
  await pushAction(localSession, CO_CORE_NAME_MEMBERSHIP, action, identity);
}

export function extractTextMessages(
  actions: Array<ReducerAction<MatrixEvent> | MatrixEvent | unknown>,
): Array<{ from: string; body: string; timestamp: number; eventId: string }> {
  const messages: Array<{ from: string; body: string; timestamp: number; eventId: string }> = [];

  for (const raw of actions) {
    const action = raw as ReducerAction<MatrixEvent> & MatrixEvent;
    const payload = (action.payload ?? action) as MatrixEvent;
    const from = action.from ?? "unknown";
    if (payload?.type === "m_room_message" && payload.content?.msgtype === "text") {
      messages.push({
        from,
        body: payload.content.body,
        timestamp: payload.timestamp ?? action.time ?? Date.now(),
        eventId: payload.event_id,
      });
    }
  }

  return messages.sort((a, b) => a.timestamp - b.timestamp);
}
