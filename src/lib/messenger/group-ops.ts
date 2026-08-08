import { v4 as uuid } from "uuid";
import {
  CID,
  createCo,
  getCoTip,
  getSharedCoSession,
  resolveCid,
} from "@/lib/co-sdk/co";
import {
  LOCAL_MEMBERSHIP_CORE,
  type Did,
  type LocalMembershipAction,
} from "@/lib/co-sdk/identity";
import { pushAction } from "@/lib/co-sdk/core";
import { type GroupAvatarColor } from "@/lib/messenger/group-avatar";
import { readProfileName } from "@/lib/messenger/profile";
import {
  nameFromCoTags,
  setCoGroupAvatarColor,
  setCoGroupNameTag,
  setCoMemberDisplayName,
} from "@/lib/messenger/tags";
import {
  CO_CORE,
  ROOM_CORE,
  ROOM_CORE_BINARY_CID,
  type MatrixEvent,
} from "@/lib/messenger/types";

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
  const binary = CID.parse(ROOM_CORE_BINARY_CID);
  await pushAction(
    session,
    CO_CORE,
    {
      CoreCreate: {
        core: ROOM_CORE,
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
  await pushAction(session, ROOM_CORE, event, identity);
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
  const cid = await pushAction(session, ROOM_CORE, event, identity);
  if (cid === undefined) {
    throw new Error(
      `Failed to send message to ${roomId}. The room session may be closed or the room core is unavailable.`,
    );
  }
}

export async function joinLocalMembership(
  localSession: string,
  identity: Did,
  coId: string,
): Promise<void> {
  const action: LocalMembershipAction = { Join: { id: coId, did: identity } };
  await pushAction(localSession, LOCAL_MEMBERSHIP_CORE, action, identity);
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

/** Invite a CoMember via wire `ParticipantInvite` (DidComm → invitee’s LocalMembership). */
export async function inviteCoMember(
  inviterDid: Did,
  coId: string,
  inviteeDid: Did,
): Promise<void> {
  const session = await getSharedCoSession(coId);

  // Keep group display tags on the CO for active members (after join).
  // Stock COKIT does not persist these onto the invitee’s pending membership.
  try {
    const [stateCid] = await getCoTip(coId);
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
    CO_CORE,
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
 * Revoke a pending CoMember invite via wire `ParticipantRemove`.
 * COKIT moves Invite → Inactive (Pending entries are deleted).
 */
export async function revokeCoMemberInvite(
  actorDid: Did,
  coId: string,
  inviteeDid: Did,
): Promise<void> {
  const session = await getSharedCoSession(coId);
  const cid = await pushAction(
    session,
    CO_CORE,
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
  const action: LocalMembershipAction = {
    InviteAccept: { id: coId, did: identity },
  };
  await pushAction(localSession, LOCAL_MEMBERSHIP_CORE, action, identity);
}

/** Decline a pending group invite (remove self from membership before accepting). */
export async function declineInvite(
  localSession: string,
  identity: Did,
  coId: string,
): Promise<void> {
  const action: LocalMembershipAction = { Remove: { id: coId, did: identity } };
  await pushAction(localSession, LOCAL_MEMBERSHIP_CORE, action, identity);
}

export async function leaveLocalMembership(
  localSession: string,
  identity: Did,
  coId: string,
): Promise<void> {
  // Remove from the shared group roster first (while we can still write to the CO).
  // Timeline “left the group” events are derived from wire ParticipantRemove.
  const roomSession = await getSharedCoSession(coId);
  const removed = await pushAction(
    roomSession,
    CO_CORE,
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
      `Failed to leave ${coId}. Could not update group members.`,
    );
  }

  // Drop our LocalMembership so the chat leaves the sidebar.
  const action: LocalMembershipAction = { Deactivate: { id: coId, did: identity } };
  await pushAction(localSession, LOCAL_MEMBERSHIP_CORE, action, identity);
}

export async function removeCoMember(
  actorDid: Did,
  coId: string,
  memberDid: Did,
): Promise<void> {
  // Roster + “removed from the group” timeline events come from the group CO.
  const session = await getSharedCoSession(coId);
  const cid = await pushAction(
    session,
    CO_CORE,
    {
      ParticipantRemove: {
        participant: memberDid,
        tags: [],
      },
    },
    actorDid,
  );
  if (cid === undefined) {
    throw new Error(
      `Failed to remove ${memberDid} from ${coId}. The group session may be closed.`,
    );
  }
}

