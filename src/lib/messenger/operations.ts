import { CID } from "multiformats/cid";
import { v4 as uuid } from "uuid";
import {
  CO_CORE_NAME_CO,
  CO_CORE_NAME_MEMBERSHIP,
  createCo,
  DagList,
  getCoState,
  getSharedCoSession,
  MembershipState,
  pushAction,
  resolveCid,
  sessionClose,
  sessionOpen,
  type Did,
  type Membership,
  type MembershipsAction,
  type ReducerAction,
  reducerActionFrom,
} from "../co-sdk";
import {
  isGroupAvatarColor,
  readGroupAvatarColor,
  writeGroupAvatarColor,
  type GroupAvatarColor,
} from "./group-avatar";
import { readProfileName } from "./profile";
import { getPeerName, rememberPeerName, rememberPeerNames } from "./peer-names";
import {
  CO_CORE_NAME_ROOM,
  CO_TAG_DISPLAY_NAME_PREFIX,
  CO_TAG_GROUP_AVATAR_COLOR,
  CO_TAG_GROUP_NAME,
  CO_TAG_INVITER_DID,
  CO_TAG_INVITER_NAME,
  ROOM_CORE_CID,
  displayNameTagKey,
  type MatrixEvent,
  type RoomSystemEvent,
} from "./types";

const GROUP_AVATAR = "/avatars/butterfly.svg";

/** @deprecated Prefer `<GroupAvatar />` — kept for any string-only call sites. */
export function avatarForCo(_coId: string): string {
  return GROUP_AVATAR;
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

export function isActiveMembership(membership: Membership, did?: Did): boolean {
  const state = membershipStateFor(membership, did);
  return state === MembershipState.Active;
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
      const list = new DagList<unknown>(dag as { n?: CID[]; l?: unknown[] }, session);
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
    return entries
      .filter((p) => p.state === PARTICIPANT_STATE_ACTIVE && typeof p.did === "string")
      .map((p) => p.did as string);
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
    return entries
      .filter((p) => p.state === PARTICIPANT_STATE_INVITE && typeof p.did === "string")
      .map((p) => p.did as string);
  } catch {
    return [];
  }
}

function tagValueAsString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    try {
      return new TextDecoder().decode(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Read group display name from CO tags (`name` key). Last matching string wins. */
export function nameFromCoTags(tags: unknown): string | undefined {
  let name: string | undefined;
  for (const [key, value] of iterTagEntries(tags)) {
    if (key !== CO_TAG_GROUP_NAME) continue;
    const text = tagValueAsString(value)?.trim();
    if (text) name = text;
  }
  return name;
}

/** Read group avatar color from CO tags (`avatar_color` key). Last matching value wins. */
export function avatarColorFromCoTags(tags: unknown): GroupAvatarColor | undefined {
  let color: GroupAvatarColor | undefined;
  for (const [key, value] of iterTagEntries(tags)) {
    if (key !== CO_TAG_GROUP_AVATAR_COLOR) continue;
    const text = tagValueAsString(value);
    if (text && isGroupAvatarColor(text)) color = text;
  }
  return color;
}

/** Collect `display_name:<did>` → name pairs from CO / membership tags. */
export function displayNamesFromCoTags(tags: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of iterTagEntries(tags)) {
    if (!key.startsWith(CO_TAG_DISPLAY_NAME_PREFIX)) continue;
    const text = tagValueAsString(value)?.trim();
    if (!text) continue;
    const did = key.slice(CO_TAG_DISPLAY_NAME_PREFIX.length);
    if (did) out[did] = text;
  }
  return out;
}

/** Ingest display-name tags into the local peer cache. */
export function ingestDisplayNamesFromTags(tags: unknown): void {
  rememberPeerNames(displayNamesFromCoTags(tags));
}

function inviterNameFromTags(tags: unknown): string | undefined {
  for (const [key, value] of iterTagEntries(tags)) {
    if (key !== CO_TAG_INVITER_NAME) continue;
    const text = tagValueAsString(value)?.trim();
    if (text) return text;
  }
  return undefined;
}

function inviterDidFromTags(tags: unknown): string | undefined {
  for (const [key, value] of iterTagEntries(tags)) {
    if (key !== CO_TAG_INVITER_DID) continue;
    const text = tagValueAsString(value)?.trim();
    if (text) return text;
  }
  return undefined;
}

/** Normalize COKIT `Tags` (array of pairs, map, or nested CBOR shapes) to `[key, value]` entries. */
function iterTagEntries(tags: unknown): Array<[string, unknown]> {
  if (tags == null) return [];
  const out: Array<[string, unknown]> = [];

  if (Array.isArray(tags)) {
    for (const entry of tags) {
      if (Array.isArray(entry) && entry.length >= 2 && typeof entry[0] === "string") {
        out.push([entry[0], entry[1]]);
        continue;
      }
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const obj = entry as Record<string, unknown>;
        if (typeof obj[0] === "string") {
          out.push([obj[0], obj[1]]);
        }
      }
    }
    return out;
  }

  // Rare JSON / IPLD map form: { name: "…", avatar_color: "…" }
  if (typeof tags === "object") {
    for (const [key, value] of Object.entries(tags as Record<string, unknown>)) {
      if (!key || /^\d+$/.test(key)) continue;
      out.push([key, value]);
    }
  }
  return out;
}

function membershipTagBag(membership: Membership): unknown {
  const raw = membership as Membership & { t?: unknown };
  return raw.tags ?? raw.t;
}

function nameTagEntries(tags: unknown): string[][] {
  return iterTagEntries(tags).filter(
    (entry): entry is [string, string] =>
      entry[0] === CO_TAG_GROUP_NAME && typeof entry[1] === "string",
  );
}

function avatarColorTagEntries(tags: unknown): string[][] {
  return iterTagEntries(tags).filter(
    (entry): entry is [string, string] =>
      entry[0] === CO_TAG_GROUP_AVATAR_COLOR && typeof entry[1] === "string",
  );
}

function memberDisplayNameTagEntries(tags: unknown, did: string): string[][] {
  const key = displayNameTagKey(did);
  return iterTagEntries(tags).filter(
    (entry): entry is [string, string] =>
      entry[0] === key && typeof entry[1] === "string",
  );
}

export type InviteDisplayMeta = {
  name?: string;
  color?: GroupAvatarColor;
  inviterName?: string;
  inviterDid?: string;
};

/** True when a resolved block looks like a CO document (not CoReference / DagList). */
function isCoDocument(node: unknown): node is {
  id: string;
  n?: unknown;
  t?: unknown;
  tags?: unknown;
} {
  if (node == null || typeof node !== "object" || Array.isArray(node)) return false;
  const o = node as Record<string, unknown>;
  return typeof o.id === "string" && ("b" in o || "c" in o || "p" in o);
}

/** CoReference::Weak serializes as `{ w: T }` (T is often `[stateCid, heads]`). */
function unwrapCoReference(node: unknown): unknown {
  if (node == null || typeof node !== "object" || Array.isArray(node)) return node;
  const o = node as Record<string, unknown>;
  if ("w" in o) return o.w;
  return node;
}

function displayMetaFromCoNode(node: unknown): InviteDisplayMeta {
  if (!isCoDocument(node)) return {};
  const tags = node.t ?? node.tags;
  const fromTags = nameFromCoTags(tags);
  const rawName = typeof node.n === "string" ? node.n.trim() : "";
  // `co.n` is the create-time name; never treat the CO id itself as a display name.
  const name =
    fromTags ||
    (rawName && rawName !== "local" && rawName !== node.id ? rawName : undefined);
  ingestDisplayNamesFromTags(tags);
  return {
    name,
    color: avatarColorFromCoTags(tags),
    inviterName: inviterNameFromTags(tags),
    inviterDid: inviterDidFromTags(tags),
  };
}

function collectCidsDeep(value: unknown, out: CID[] = [], depth = 0): CID[] {
  if (value == null || depth > 10) return out;
  if (isCid(value)) {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectCidsDeep(item, out, depth + 1);
    return out;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectCidsDeep(item, out, depth + 1);
    }
  }
  return out;
}

function mergeInviteMeta(into: InviteDisplayMeta, from: InviteDisplayMeta): void {
  if (from.name && !into.name) into.name = from.name;
  if (from.color && !into.color) into.color = from.color;
  if (from.inviterName && !into.inviterName) into.inviterName = from.inviterName;
  if (from.inviterDid && !into.inviterDid) into.inviterDid = from.inviterDid;
}

function inviteMetaComplete(meta: InviteDisplayMeta): boolean {
  return !!(meta.name && meta.color);
}

/**
 * Invite/Join memberships cannot `sessionOpen` the group CO yet.
 * DidComm stores CO tags + a state snapshot on the membership — resolve those
 * via the local session to recover display name + avatar color.
 */
export async function inviteDisplayMetaFromMembership(
  localSession: string,
  membership: Membership,
): Promise<InviteDisplayMeta> {
  const tagBag = membershipTagBag(membership);
  ingestDisplayNamesFromTags(tagBag);
  const inviterName = inviterNameFromTags(tagBag);
  const inviterDid = inviterDidFromTags(tagBag);
  if (inviterDid && inviterName) rememberPeerName(inviterDid, inviterName);

  const result: InviteDisplayMeta = {
    name: nameFromCoTags(tagBag),
    color: avatarColorFromCoTags(tagBag),
    inviterName,
    inviterDid,
  };
  if (inviteMetaComplete(result) && result.inviterName) {
    return result;
  }

  const seen = new Set<string>();

  async function absorbCid(cid: CID): Promise<void> {
    const key = cid.toString();
    if (seen.has(key)) return;
    seen.add(key);
    try {
      const node = await resolveCid(localSession, cid);
      const unwrapped = unwrapCoReference(node);

      // CoReference::Weak<(Cid, heads)> → follow the state cid.
      if (Array.isArray(unwrapped) && unwrapped.length >= 1 && isCid(unwrapped[0])) {
        await absorbCid(unwrapped[0]);
        return;
      }

      // CoState { state: Cid } — Link serializes as bare Cid.
      if (
        unwrapped &&
        typeof unwrapped === "object" &&
        !Array.isArray(unwrapped) &&
        isCid((unwrapped as { state?: unknown }).state)
      ) {
        await absorbCid((unwrapped as { state: CID }).state);
      }

      if (isCoDocument(unwrapped)) {
        mergeInviteMeta(result, displayMetaFromCoNode(unwrapped));
      } else if (isCoDocument(node)) {
        mergeInviteMeta(result, displayMetaFromCoNode(node));
      }

      if (inviteMetaComplete(result) && result.inviterName) return;

      for (const nested of collectCidsDeep(unwrapped ?? node)) {
        if (inviteMetaComplete(result) && result.inviterName) return;
        await absorbCid(nested);
      }
    } catch {
      // try next cid
    }
  }

  for (const cid of collectCidsDeep(membership.state)) {
    if (inviteMetaComplete(result) && result.inviterName) break;
    await absorbCid(cid);
  }

  // Reject accidental id-as-name from older resolvers / bad snapshots.
  if (result.name && (result.name === membership.id || result.name === "local")) {
    result.name = undefined;
  }

  if (result.inviterDid && result.inviterName) {
    rememberPeerName(result.inviterDid, result.inviterName);
  }
  return result;
}

/** Persist group name on CO tags so DidComm invites include it (`CoInvitePayload.tags`). */
export async function setCoGroupNameTag(
  session: string,
  identity: Did,
  coId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const [stateCid] = await getCoState(coId);
  if (stateCid) {
    const co = (await resolveCid(session, stateCid)) as { t?: unknown };
    const existing = nameTagEntries(co.t);
    if (existing.length > 0) {
      await pushAction(
        session,
        CO_CORE_NAME_CO,
        { TagsRemove: { tags: existing } },
        identity,
      );
    }
  }

  await pushAction(
    session,
    CO_CORE_NAME_CO,
    { TagsInsert: { tags: [[CO_TAG_GROUP_NAME, trimmed]] } },
    identity,
  );
}

/** Persist group avatar color on CO tags so all members see the same color. */
export async function setCoGroupAvatarColor(
  session: string,
  identity: Did,
  coId: string,
  color: GroupAvatarColor,
): Promise<void> {
  const [stateCid] = await getCoState(coId);
  if (stateCid) {
    const co = (await resolveCid(session, stateCid)) as { t?: unknown };
    const existing = avatarColorTagEntries(co.t);
    if (existing.length > 0) {
      await pushAction(
        session,
        CO_CORE_NAME_CO,
        { TagsRemove: { tags: existing } },
        identity,
      );
    }
  }

  await pushAction(
    session,
    CO_CORE_NAME_CO,
    { TagsInsert: { tags: [[CO_TAG_GROUP_AVATAR_COLOR, color]] } },
    identity,
  );
  writeGroupAvatarColor(coId, color);
}

/**
 * Publish this member’s display name onto a group CO so peers can resolve it
 * (chats, system events, roster). Tag key is `display_name:<did>`.
 */
export async function setCoMemberDisplayName(
  session: string,
  identity: Did,
  coId: string,
  displayNameValue: string,
): Promise<void> {
  const trimmed = displayNameValue.trim();
  if (!trimmed) return;

  const tagKey = displayNameTagKey(identity);
  const [stateCid] = await getCoState(coId);
  if (stateCid) {
    const co = (await resolveCid(session, stateCid)) as { t?: unknown };
    const existing = memberDisplayNameTagEntries(co.t, identity);
    // Skip write if unchanged.
    if (existing.some(([, value]) => value === trimmed) && existing.length === 1) {
      rememberPeerName(identity, trimmed);
      return;
    }
    if (existing.length > 0) {
      await pushAction(
        session,
        CO_CORE_NAME_CO,
        { TagsRemove: { tags: existing } },
        identity,
      );
    }
  }

  await pushAction(
    session,
    CO_CORE_NAME_CO,
    { TagsInsert: { tags: [[tagKey, trimmed]] } },
    identity,
  );
  rememberPeerName(identity, trimmed);
}

/** Push the local profile name to every listed group CO (best-effort). */
export async function publishDisplayNameToGroups(
  identity: Did,
  displayNameValue: string,
  coIds: string[],
): Promise<void> {
  const trimmed = displayNameValue.trim();
  if (!trimmed || coIds.length === 0) return;
  await Promise.all(
    coIds.map(async (coId) => {
      try {
        const session = await getSharedCoSession(coId);
        await setCoMemberDisplayName(session, identity, coId, trimmed);
      } catch (err) {
        console.warn(`Failed to publish display name to ${coId}`, err);
      }
    }),
  );
}

export async function createGroupChat(
  identity: Did,
  name: string,
  avatarColor?: GroupAvatarColor,
): Promise<string> {
  const coId = await createCo(identity, name, false);
  const session = await sessionOpen(coId);
  try {
    await ensureRoomCore(session, identity);
    await setRoomName(session, identity, coId, name);
    await setCoGroupNameTag(session, identity, coId, name);
    if (avatarColor) {
      await setCoGroupAvatarColor(session, identity, coId, avatarColor);
    }
    const profile = readProfileName();
    if (profile) {
      await setCoMemberDisplayName(session, identity, coId, profile);
    }
  } finally {
    await sessionClose(session);
  }
  return coId;
}

export async function ensureRoomCore(session: string, identity: Did): Promise<void> {
  const binary = CID.parse(ROOM_CORE_CID);
  await pushAction(
    session,
    CO_CORE_NAME_CO,
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

export async function pushRoomSystemEvent(
  session: string,
  identity: Did,
  roomId: string,
  content: RoomSystemEvent,
): Promise<void> {
  // Real room core only accepts co_messaging::EventContent (messages, room_name, …).
  // m.room.system is not supported by storage — keep as a no-op.
  void session;
  void identity;
  void roomId;
  void content;
}

export async function renameGroupChat(
  identity: Did,
  coId: string,
  name: string,
): Promise<void> {
  const session = await getSharedCoSession(coId);
  await setRoomName(session, identity, coId, name);
  await setCoGroupNameTag(session, identity, coId, name);
}

export async function setGroupAvatarColor(
  identity: Did,
  coId: string,
  color: GroupAvatarColor,
): Promise<void> {
  const session = await getSharedCoSession(coId);
  await setCoGroupAvatarColor(session, identity, coId, color);
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
  const cid = await pushAction(session, CO_CORE_NAME_ROOM, event, identity);
  if (cid === undefined) {
    throw new Error(
      `Failed to send message to ${roomId}. The room session may be closed or the room core is unavailable.`,
    );
  }
}

export async function joinMembership(
  localSession: string,
  identity: Did,
  coId: string,
  options?: { emitSystemEvent?: boolean },
): Promise<void> {
  const action: MembershipsAction = { Join: { id: coId, did: identity } };
  await pushAction(localSession, CO_CORE_NAME_MEMBERSHIP, action, identity);
  if (options?.emitSystemEvent === false) {
    // Still publish display name when joining without a system event (create flow).
    try {
      const profile = readProfileName();
      if (profile) {
        const roomSession = await getSharedCoSession(coId);
        await setCoMemberDisplayName(roomSession, identity, coId, profile);
      }
    } catch (err) {
      console.warn("Failed to publish display name on join:", err);
    }
    return;
  }
  const roomSession = await getSharedCoSession(coId);
  await pushRoomSystemEvent(roomSession, identity, coId, {
    variant: "member_added",
    member: identity,
  });
  try {
    const profile = readProfileName();
    if (profile) {
      await setCoMemberDisplayName(roomSession, identity, coId, profile);
    }
  } catch (err) {
    console.warn("Failed to publish display name on join:", err);
  }
}

/** Invite via group `ParticipantInvite` (DidComm → invitee’s local membership). */
export async function inviteParticipant(
  _localSession: string,
  inviterDid: Did,
  coId: string,
  inviteeDid: Did,
): Promise<void> {
  const session = await getSharedCoSession(coId);

  // DidComm invite copies `co.tags` into the payload. Ensure name + avatar color
  // + inviter display name tags are on the CO before inviting.
  let inviteTags: string[][] = [];
  try {
    const [stateCid] = await getCoState(coId);
    if (stateCid) {
      const co = (await resolveCid(session, stateCid)) as { n?: string; t?: unknown };
      if (!nameFromCoTags(co.t)) {
        const name = typeof co.n === "string" ? co.n.trim() : "";
        if (name) await setCoGroupNameTag(session, inviterDid, coId, name);
      }
      if (!avatarColorFromCoTags(co.t)) {
        const localColor = readGroupAvatarColor(coId);
        if (isGroupAvatarColor(localColor)) {
          await setCoGroupAvatarColor(session, inviterDid, coId, localColor);
        }
      }
      const profile = readProfileName();
      if (profile) {
        await setCoMemberDisplayName(session, inviterDid, coId, profile);
      }

      const [freshStateCid] = await getCoState(coId);
      const fresh = freshStateCid
        ? ((await resolveCid(session, freshStateCid)) as { n?: string; t?: unknown })
        : co;
      const name =
        nameFromCoTags(fresh.t) ||
        (typeof fresh.n === "string" ? fresh.n.trim() : "") ||
        undefined;
      const color = avatarColorFromCoTags(fresh.t);
      if (name) inviteTags.push([CO_TAG_GROUP_NAME, name]);
      if (color) inviteTags.push([CO_TAG_GROUP_AVATAR_COLOR, color]);
      if (profile) {
        inviteTags.push([CO_TAG_INVITER_NAME, profile]);
        inviteTags.push([CO_TAG_INVITER_DID, inviterDid]);
        inviteTags.push([displayNameTagKey(inviterDid), profile]);
      }
    }
  } catch (err) {
    console.warn("Could not ensure invite display tags before invite:", err);
  }

  const cid = await pushAction(
    session,
    CO_CORE_NAME_CO,
    {
      ParticipantInvite: {
        participant: inviteeDid,
        // Also attach display tags on the invite action (DidComm invite_send
        // still prefers `co.tags`, which we synced above).
        tags: inviteTags,
      },
    },
    inviterDid,
  );
  if (cid === undefined) {
    throw new Error(
      `Failed to invite ${inviteeDid} to ${coId}. The group session may be closed or the invite was rejected.`,
    );
  }
}

/**
 * Revoke a pending invite via group `ParticipantRemove`.
 * COKIT moves Invite → Inactive (Pending entries are deleted).
 */
export async function revokeInvite(
  actorDid: Did,
  coId: string,
  inviteeDid: Did,
): Promise<void> {
  const session = await getSharedCoSession(coId);
  const cid = await pushAction(
    session,
    CO_CORE_NAME_CO,
    {
      ParticipantRemove: {
        participant: inviteeDid,
        tags: [],
      },
    },
    actorDid,
  );
  if (cid === undefined) {
    throw new Error(
      `Failed to revoke invite for ${inviteeDid} in ${coId}. The group session may be closed.`,
    );
  }
}

export async function acceptInvite(
  localSession: string,
  identity: Did,
  coId: string,
): Promise<void> {
  // COKIT: Invite → Join via InviteAccept. The runtime promotes Join → Active
  // once the peer handshake finishes. Opening the group CO before Active fails
  // with "No active membership". (Docs mention ChangeMembershipState, but the
  // membership core only accepts InviteAccept.)
  const action: MembershipsAction = {
    InviteAccept: { id: coId, did: identity },
  };
  await pushAction(localSession, CO_CORE_NAME_MEMBERSHIP, action, identity);
}

/** Decline a pending group invite (remove self from membership before accepting). */
export async function declineInvite(
  localSession: string,
  identity: Did,
  coId: string,
): Promise<void> {
  const action: MembershipsAction = { Remove: { id: coId, did: identity } };
  await pushAction(localSession, CO_CORE_NAME_MEMBERSHIP, action, identity);
}

export async function leaveMembership(
  localSession: string,
  identity: Did,
  coId: string,
): Promise<void> {
  // Remove from the shared group roster first (while we can still write to the CO).
  // Timeline “left the group” events are derived from this ParticipantRemove action.
  const roomSession = await getSharedCoSession(coId);
  const removed = await pushAction(
    roomSession,
    CO_CORE_NAME_CO,
    {
      ParticipantRemove: {
        participant: identity,
        tags: [],
      },
    },
    identity,
  );
  if (removed === undefined) {
    throw new Error(
      `Failed to leave ${coId}. Could not update group participants.`,
    );
  }

  // Drop our local membership so the chat leaves the sidebar.
  const action: MembershipsAction = { Deactivate: { id: coId, did: identity } };
  await pushAction(localSession, CO_CORE_NAME_MEMBERSHIP, action, identity);
}

export async function removeParticipant(
  _localSession: string,
  actorDid: Did,
  coId: string,
  participantDid: Did,
): Promise<void> {
  // Roster + “removed from the group” timeline events come from the group CO.
  const session = await getSharedCoSession(coId);
  const cid = await pushAction(
    session,
    CO_CORE_NAME_CO,
    {
      ParticipantRemove: {
        participant: participantDid,
        tags: [],
      },
    },
    actorDid,
  );
  if (cid === undefined) {
    throw new Error(
      `Failed to remove ${participantDid} from ${coId}. The group session may be closed.`,
    );
  }
}

export function displayName(did: string, selfDid?: string): string {
  if (selfDid && did === selfDid) {
    const profile = readProfileName();
    if (profile) return profile;
  }
  const peer = getPeerName(did);
  if (peer) return peer;
  return truncateDid(did);
}

export type ChatMessageItem = {
  kind: "message";
  from: string;
  body: string;
  timestamp: number;
  eventId: string;
};

export type SystemTimelineEvent = {
  kind: "system";
  variant: RoomSystemEvent["variant"];
  actorDid: string;
  timestamp: number;
  eventId: string;
} & (
  | { variant: "group_created"; members: string[] }
  | { variant: "member_added"; member: string }
  | { variant: "member_removed"; member: string }
  | { variant: "group_icon_changed" }
  | { variant: "group_name_changed" }
);

export type ChatTimelineItem = ChatMessageItem | SystemTimelineEvent;

/** COKIT `Date` / CBOR may arrive as number or bigint. Never use Date.now() for ordering. */
function coerceTime(...candidates: unknown[]): number | undefined {
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "bigint") {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function systemEventFromPayload(
  payload: MatrixEvent,
  from: string,
): SystemTimelineEvent | undefined {
  const timestamp = coerceTime(payload.timestamp) ?? 0;
  const eventId = payload.event_id;
  const base = { kind: "system" as const, actorDid: from, timestamp, eventId };

  if (payload.type === "room_name") {
    return {
      ...base,
      variant: "group_name_changed",
    };
  }

  if (payload.type !== "m.room.system") return undefined;

  const content = payload.content;
  switch (content.variant) {
    case "group_created":
      return {
        ...base,
        variant: "group_created",
        members: content.members,
      };
    case "member_added":
      return {
        ...base,
        variant: "member_added",
        member: content.member,
      };
    case "member_removed":
      return {
        ...base,
        variant: "member_removed",
        member: content.member,
      };
    case "group_icon_changed":
      return {
        ...base,
        variant: "group_icon_changed",
      };
    case "group_name_changed":
      return {
        ...base,
        variant: "group_name_changed",
      };
  }
}

type TimedTimelineItem = ChatTimelineItem & {
  sortIndex: number;
  hasTime: boolean;
};

/**
 * Real CO `get_actions` streams newest → oldest. Detect order from
 * timestamps when present; otherwise treat as newest-first.
 * Normalize to chronological so the first `room_name` is the create event.
 * Never use Date.now() for ordering — that pushed "created this group"
 * below messages that already had real timestamps.
 */
function actionSampleTime(raw: unknown): number | undefined {
  const parsed = reducerActionFrom<unknown>(raw);
  const payload = (parsed.payload ?? raw) as Record<string, unknown>;
  return coerceTime(
    (payload as { timestamp?: unknown }).timestamp,
    payload.timestamp,
    parsed.time,
  );
}

function toChronologicalActions(
  actions: Array<ReducerAction<MatrixEvent> | MatrixEvent | unknown>,
): Array<ReducerAction<MatrixEvent> | MatrixEvent | unknown> {
  const samples: number[] = [];
  for (const raw of actions) {
    const t = actionSampleTime(raw);
    if (t === undefined) continue;
    samples.push(t);
    if (samples.length >= 4) break;
  }
  if (samples.length < 2) return actions;

  let descending = 0;
  let ascending = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i] < samples[i - 1]) descending += 1;
    if (samples[i] > samples[i - 1]) ascending += 1;
  }
  // Newest-first logs trend descending; reverse them before synthesizing create.
  return descending > ascending ? [...actions].reverse() : actions;
}

export function extractTimelineItems(
  actions: Array<ReducerAction<MatrixEvent> | MatrixEvent | unknown>,
): ChatTimelineItem[] {
  const chronological = toChronologicalActions(actions);
  const items: TimedTimelineItem[] = [];
  let seenRoomName = false;
  let seenGroupCreated = false;

  for (const [index, raw] of chronological.entries()) {
    const parsed = reducerActionFrom<unknown>(raw);
    const { from, time, core } = parsed;
    const payload = (parsed.payload ?? raw) as Record<string, unknown>;
    const matrixPayload = payload as unknown as MatrixEvent;
    const timestamp = coerceTime(
      matrixPayload?.timestamp,
      payload.timestamp,
      time,
    );
    const hasTime = timestamp !== undefined;
    const ts = timestamp ?? 0;

    // Group CO core actions (shared across members).
    if (core === CO_CORE_NAME_CO || core === undefined) {
      const coEvent = systemEventFromCoAction(payload, from, ts, index);
      if (coEvent) {
        items.push({ ...coEvent, sortIndex: index, hasTime });
        continue;
      }
    }

    if (
      matrixPayload?.type === "m_room_message" &&
      matrixPayload.content?.msgtype === "text"
    ) {
      const messageTs = coerceTime(matrixPayload.timestamp, time);
      items.push({
        kind: "message",
        body: matrixPayload.content.body,
        from,
        timestamp: messageTs ?? ts,
        eventId: matrixPayload.event_id,
        sortIndex: index,
        hasTime: messageTs !== undefined || hasTime,
      });
      continue;
    }

    if (
      matrixPayload.type === "m.room.system" &&
      matrixPayload.content?.variant === "group_created"
    ) {
      seenGroupCreated = true;
      const systemEvent = systemEventFromPayload(matrixPayload, from);
      if (systemEvent) {
        items.push({
          ...systemEvent,
          timestamp: coerceTime(matrixPayload.timestamp, time) ?? ts,
          sortIndex: index,
          hasTime: coerceTime(matrixPayload.timestamp, time) !== undefined || hasTime,
        });
      }
      continue;
    }

    if (matrixPayload.type === "room_name") {
      if (!seenRoomName) {
        seenRoomName = true;
        if (!seenGroupCreated) {
          items.push({
            kind: "system",
            variant: "group_created",
            actorDid: from,
            timestamp: ts,
            eventId: matrixPayload.event_id,
            members: [],
            sortIndex: index,
            hasTime,
          });
        }
        continue;
      }

      const systemEvent = systemEventFromPayload(matrixPayload, from);
      if (systemEvent) {
        items.push({
          ...systemEvent,
          timestamp: coerceTime(matrixPayload.timestamp, time) ?? ts,
          sortIndex: index,
          hasTime: coerceTime(matrixPayload.timestamp, time) !== undefined || hasTime,
        });
      }
      continue;
    }

    const systemEvent = systemEventFromPayload(matrixPayload, from);
    if (systemEvent) {
      items.push({
        ...systemEvent,
        timestamp: coerceTime(matrixPayload.timestamp, time) ?? ts,
        sortIndex: index,
        hasTime: coerceTime(matrixPayload.timestamp, time) !== undefined || hasTime,
      });
    }
  }

  return dedupeCreatorJoinEvent(finalizeTimelineOrder(items));
}

/** Place undated events by log order around dated anchors — keeps create before messages. */
function finalizeTimelineOrder(items: TimedTimelineItem[]): ChatTimelineItem[] {
  const byIndex = [...items].sort((a, b) => a.sortIndex - b.sortIndex);
  const firstDatedIdx = byIndex.findIndex((item) => item.hasTime);

  if (firstDatedIdx === -1) {
    return byIndex.map(({ sortIndex: _, hasTime: __, ...item }, i) => ({
      ...item,
      timestamp: i,
    }));
  }

  // Leading undated events sit just before the first dated one.
  let cursor = byIndex[firstDatedIdx].timestamp;
  for (let i = firstDatedIdx - 1; i >= 0; i--) {
    if (!byIndex[i].hasTime) {
      cursor -= 1;
      byIndex[i].timestamp = cursor;
    } else {
      cursor = byIndex[i].timestamp;
    }
  }

  // Interstitial / trailing undated events follow the previous event in log order.
  for (let i = 1; i < byIndex.length; i++) {
    const prev = byIndex[i - 1];
    const cur = byIndex[i];
    if (!cur.hasTime && cur.timestamp <= prev.timestamp) {
      cur.timestamp = prev.timestamp + 1;
    }
  }

  return byIndex
    .sort((a, b) => a.timestamp - b.timestamp || a.sortIndex - b.sortIndex)
    .map(({ sortIndex: _, hasTime: __, ...item }) => item);
}

/** Map group-CO `ParticipantJoin` / `ParticipantRemove` into timeline system events. */
function systemEventFromCoAction(
  payload: Record<string, unknown>,
  from: string,
  timestamp: number,
  index: number,
): SystemTimelineEvent | undefined {
  if ("ParticipantJoin" in payload) {
    const join = payload.ParticipantJoin as { participant?: string };
    if (typeof join?.participant !== "string") return undefined;
    // Inviter pushes join; show as the member joining.
    const member = join.participant;
    return {
      kind: "system",
      variant: "member_added",
      actorDid: member,
      member,
      timestamp,
      eventId: `co-join-${index}-${member}-${timestamp}`,
    };
  }

  if ("ParticipantRemove" in payload) {
    const remove = payload.ParticipantRemove as { participant?: string };
    if (typeof remove?.participant !== "string") return undefined;
    return {
      kind: "system",
      variant: "member_removed",
      actorDid: from,
      member: remove.participant,
      timestamp,
      eventId: `co-remove-${index}-${remove.participant}-${timestamp}`,
    };
  }

  return undefined;
}

function dedupeCreatorJoinEvent(items: ChatTimelineItem[]): ChatTimelineItem[] {
  const groupCreated = items.find(
    (item): item is SystemTimelineEvent =>
      item.kind === "system" && item.variant === "group_created",
  );
  if (!groupCreated) return items;

  return items.filter((item) => {
    if (item.kind !== "system" || item.variant !== "member_added") return true;
    if (item.member !== item.actorDid || item.actorDid !== groupCreated.actorDid) {
      return true;
    }
    return Math.abs(item.timestamp - groupCreated.timestamp) > 60_000;
  });
}

export function extractTextMessages(
  actions: Array<ReducerAction<MatrixEvent> | MatrixEvent | unknown>,
): Array<{ from: string; body: string; timestamp: number; eventId: string }> {
  return extractTimelineItems(actions)
    .filter((item): item is ChatMessageItem => item.kind === "message")
    .map(({ from, body, timestamp, eventId }) => ({ from, body, timestamp, eventId }));
}

/** Latest timeline item timestamp (messages + system / membership events). */
export function lastActivityTimestamp(
  actions: Array<ReducerAction<MatrixEvent> | MatrixEvent | unknown>,
): number | undefined {
  const items = extractTimelineItems(actions);
  if (items.length === 0) return undefined;
  let latest = items[0].timestamp;
  for (let i = 1; i < items.length; i++) {
    if (items[i].timestamp > latest) latest = items[i].timestamp;
  }
  return latest;
}
