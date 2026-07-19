import { CID } from "multiformats/cid";
import { type Did, type LocalMembership } from "@/lib/co-sdk/identity";
import { getCoTip, getSharedCoSession, resolveCid } from "@/lib/co-sdk/co";
import { pushAction } from "@/lib/co-sdk/core";
import {
  isGroupAvatarColor,
  type GroupAvatarColor,
} from "./group-avatar";
import { getPeerName, rememberPeerName, rememberPeerNames } from "./peer-names";
import {
  CO_CORE,
  CO_TAG_DISPLAY_NAME_PREFIX,
  CO_TAG_GROUP_AVATAR_COLOR,
  CO_TAG_GROUP_NAME,
  CO_TAG_INVITER_DID,
  CO_TAG_INVITER_NAME,
  displayNameTagKey,
} from "./types";

function tagValueAsString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    try {
      return new TextDecoder().decode(value);
    } catch {
      return undefined;
    }
  }
  // Some serde / schema paths encode TagValue as `{ String: "…" }`.
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.String === "string") return obj.String;
    if (typeof obj.string === "string") return obj.string;
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

function displayNamesFromCoTags(tags: unknown): Record<string, string> {
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

/** Membership tag: CID → `CoInviteMetadata` (always set by COKIT on invite receive). */
const CO_TAG_INVITE_METADATA = "co-invite-metadata";

function tagValueAsCid(value: unknown): CID | undefined {
  const direct = CID.asCID(value);
  if (direct) return direct;
  if (value == null || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  if (typeof obj["/"] === "string") {
    try {
      return CID.parse(obj["/"]);
    } catch {
      return undefined;
    }
  }
  if ("Link" in obj) return tagValueAsCid(obj.Link);
  if ("link" in obj) return tagValueAsCid(obj.link);
  return undefined;
}

function inviterDidFromTags(tags: unknown): string | undefined {
  for (const [key, value] of iterTagEntries(tags)) {
    if (key !== CO_TAG_INVITER_DID) continue;
    const text = tagValueAsString(value)?.trim();
    if (text?.startsWith("did:")) return text;
  }
  return undefined;
}

async function inviterDidFromInviteMetadata(
  localSession: string,
  tags: unknown,
): Promise<string | undefined> {
  for (const [key, value] of iterTagEntries(tags)) {
    if (key !== CO_TAG_INVITE_METADATA) continue;
    const cid = tagValueAsCid(value);
    if (!cid) continue;
    try {
      const meta = (await resolveCid(localSession, cid)) as { from?: unknown };
      if (typeof meta?.from === "string" && meta.from.startsWith("did:")) {
        return meta.from;
      }
    } catch {
      // try next tag
    }
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

function membershipTagBag(membership: LocalMembership): unknown {
  const raw = membership as LocalMembership & { t?: unknown };
  return raw.tags ?? raw.t;
}

function stringTagEntries(tags: unknown, key: string): string[][] {
  return iterTagEntries(tags).filter(
    (entry): entry is [string, string] =>
      entry[0] === key && typeof entry[1] === "string",
  );
}

/**
 * Replace existing string tags for `key` with `value` on the group CO.
 * When `skipIfUnchanged` is set, no-ops if a single matching value is already present.
 */
async function upsertCoTag(
  session: string,
  identity: Did,
  coId: string,
  key: string,
  value: string,
  options?: { skipIfUnchanged?: boolean },
): Promise<boolean> {
  const [stateCid] = await getCoTip(coId);
  if (stateCid) {
    const co = (await resolveCid(session, stateCid)) as { t?: unknown };
    const existing = stringTagEntries(co.t, key);
    if (
      options?.skipIfUnchanged &&
      existing.length === 1 &&
      existing[0][1] === value
    ) {
      return false;
    }
    if (existing.length > 0) {
      await pushAction(
        session,
        CO_CORE,
        { TagsRemove: { tags: existing } },
        identity,
      );
    }
  }

  await pushAction(
    session,
    CO_CORE,
    { TagsInsert: { tags: [[key, value]] } },
    identity,
  );
  return true;
}

export type InviteDisplayMeta = {
  inviterName?: string;
  inviterDid?: string;
};

/**
 * Pending invites cannot open the group CO yet.
 * Stock COKIT only keeps `co-invite-metadata` on the membership (not group
 * name/color tags), so we resolve the inviter DID from that metadata only.
 */
export async function inviteDisplayMetaFromLocalMembership(
  localSession: string,
  membership: LocalMembership,
): Promise<InviteDisplayMeta> {
  const tagBag = membershipTagBag(membership);
  ingestDisplayNamesFromTags(tagBag);

  const inviterDid =
    inviterDidFromTags(tagBag) ??
    (await inviterDidFromInviteMetadata(localSession, tagBag));
  const inviterName =
    inviterNameFromTags(tagBag) ||
    (inviterDid ? getPeerName(inviterDid) : undefined);

  if (inviterDid && inviterName) rememberPeerName(inviterDid, inviterName);

  return { inviterDid, inviterName };
}

/** Persist group name on CO tags (visible after join / to active members). */
export async function setCoGroupNameTag(
  session: string,
  identity: Did,
  coId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await upsertCoTag(session, identity, coId, CO_TAG_GROUP_NAME, trimmed);
}

/** Persist group avatar color on CO tags so all members see the same color. */
export async function setCoGroupAvatarColor(
  session: string,
  identity: Did,
  coId: string,
  color: GroupAvatarColor,
): Promise<void> {
  await upsertCoTag(session, identity, coId, CO_TAG_GROUP_AVATAR_COLOR, color);
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

  const wrote = await upsertCoTag(
    session,
    identity,
    coId,
    displayNameTagKey(identity),
    trimmed,
    { skipIfUnchanged: true },
  );
  if (wrote || trimmed) rememberPeerName(identity, trimmed);
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
