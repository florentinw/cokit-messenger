import { CID } from "multiformats/cid";
import { v4 as uuid } from "uuid";
import {
  CO_CORE_NAME_MEMBERSHIP,
  createCo,
  getCoState,
  getSharedCoSession,
  pushAction,
  resolveCid,
  type Did,
  type MembershipsAction,
} from "../co-sdk-extras";
import { type GroupAvatarColor } from "./group-avatar";
import { readProfileName } from "./profile";
import {
  nameFromCoTags,
  setCoGroupAvatarColor,
  setCoGroupNameTag,
  setCoMemberDisplayName,
} from "./tags";
import {
  CO_CORE_NAME_CO,
  CO_CORE_NAME_ROOM,
  ROOM_CORE_CID,
  type MatrixEvent,
} from "./types";

export async function createGroupChat(
  identity: Did,
  name: string,
  avatarColor?: GroupAvatarColor,
): Promise<string> {
  const coId = await createCo(identity, name, false);
  const session = await getSharedCoSession(coId);
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
): Promise<void> {
  const action: MembershipsAction = { Join: { id: coId, did: identity } };
  await pushAction(localSession, CO_CORE_NAME_MEMBERSHIP, action, identity);
  try {
    const profile = readProfileName();
    if (profile) {
      const roomSession = await getSharedCoSession(coId);
      await setCoMemberDisplayName(roomSession, identity, coId, profile);
    }
  } catch (err) {
    console.warn("Failed to publish display name on join:", err);
  }
}

/** Invite via group `ParticipantInvite` (DidComm → invitee’s local membership). */
export async function inviteParticipant(
  inviterDid: Did,
  coId: string,
  inviteeDid: Did,
): Promise<void> {
  const session = await getSharedCoSession(coId);

  // Keep group display tags on the CO for active members (after join).
  // Stock COKIT does not persist these onto the invitee’s pending membership.
  try {
    const [stateCid] = await getCoState(coId);
    if (stateCid) {
      const co = (await resolveCid(session, stateCid)) as { n?: string; t?: unknown };
      if (!nameFromCoTags(co.t)) {
        const name = typeof co.n === "string" ? co.n.trim() : "";
        if (name) await setCoGroupNameTag(session, inviterDid, coId, name);
      }
      const profile = readProfileName();
      if (profile) {
        await setCoMemberDisplayName(session, inviterDid, coId, profile);
      }
    }
  } catch (err) {
    console.warn("Could not ensure group display tags before invite:", err);
  }

  const cid = await pushAction(
    session,
    CO_CORE_NAME_CO,
    {
      ParticipantInvite: {
        participant: inviteeDid,
        tags: [],
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

