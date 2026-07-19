import { displayName } from "@/lib/messenger/format";
import { CO_CORE, type MatrixEvent, type RoomSystemEvent } from "@/lib/messenger/types";

/**
 * COKIT stores reducer actions with short CBOR keys (`f`/`t`/`c`/`p`).
 * Some callers may still use the long names (`from`/`time`/`content`/`payload`).
 */
interface ReducerAction<T> {
  f?: string;
  from?: string;
  t?: number;
  time?: number;
  c?: string;
  core?: string;
  p?: T;
  payload?: T;
}

function reducerActionFrom<T>(action: ReducerAction<T> | unknown): {
  from: string;
  time: number | undefined;
  core: string | undefined;
  payload: T | undefined;
} {
  const raw = action as ReducerAction<T>;
  return {
    from: raw.f ?? raw.from ?? "unknown",
    time: raw.t ?? raw.time,
    core: raw.c ?? raw.core,
    payload: raw.p ?? raw.payload,
  };
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
  actorDid: string;
  timestamp: number;
  eventId: string;
} & RoomSystemEvent;

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
    default: {
      const _exhaustive: never = content;
      return _exhaustive;
    }
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
  return coerceTime(payload.timestamp, parsed.time);
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
    const eventTs = coerceTime(matrixPayload.timestamp, payload.timestamp, time);
    const hasTime = eventTs !== undefined;
    const ts = eventTs ?? 0;

    // Group CO core actions (shared across members).
    if (core === CO_CORE || core === undefined) {
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
      items.push({
        kind: "message",
        body: matrixPayload.content.body,
        from,
        timestamp: ts,
        eventId: matrixPayload.event_id,
        sortIndex: index,
        hasTime,
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
          timestamp: ts,
          sortIndex: index,
          hasTime,
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
          timestamp: ts,
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
        timestamp: ts,
        sortIndex: index,
        hasTime,
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

/** Map wire CoMember actions (`ParticipantJoin` / `ParticipantRemove`) into timeline system events. */
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

export function textMessagesFromTimeline(
  items: ChatTimelineItem[],
): Array<{ from: string; body: string; timestamp: number; eventId: string }> {
  return items
    .filter((item): item is ChatMessageItem => item.kind === "message")
    .map(({ from, body, timestamp, eventId }) => ({ from, body, timestamp, eventId }));
}

/** Latest timestamp from an already-parsed timeline. */
export function lastActivityFromTimeline(items: ChatTimelineItem[]): number | undefined {
  if (items.length === 0) return undefined;
  let latest = items[0].timestamp;
  for (let i = 1; i < items.length; i++) {
    if (items[i].timestamp > latest) latest = items[i].timestamp;
  }
  return latest;
}

export type SystemEventTextPart = {
  text: string;
  emphasis?: boolean;
};

/** Plain / rich copy for system timeline events (sidebar preview + chat bubbles). */
export function systemEventTextParts(
  event: SystemTimelineEvent,
  selfDid?: string,
): SystemEventTextPart[] {
  const actorName = displayName(event.actorDid, selfDid);

  switch (event.variant) {
    case "group_created": {
      const members = event.members.map((did) => displayName(did, selfDid));
      if (members.length === 0) {
        return [
          { text: actorName, emphasis: true },
          { text: " created this group" },
        ];
      }
      if (members.length === 1) {
        return [
          { text: actorName, emphasis: true },
          { text: " created this group with " },
          { text: members[0], emphasis: true },
        ];
      }
      const last = members[members.length - 1];
      const rest = members.slice(0, -1);
      const parts: SystemEventTextPart[] = [
        { text: actorName, emphasis: true },
        { text: " created this group with " },
      ];
      for (const [index, member] of rest.entries()) {
        parts.push({ text: member, emphasis: true });
        parts.push({ text: index === rest.length - 1 ? " & " : ", " });
      }
      parts.push({ text: last, emphasis: true });
      return parts;
    }
    case "member_added":
      if (event.actorDid === event.member) {
        return [
          { text: displayName(event.member, selfDid), emphasis: true },
          { text: " joined the group" },
        ];
      }
      return [
        { text: actorName, emphasis: true },
        { text: " added " },
        { text: displayName(event.member, selfDid), emphasis: true },
        { text: " to the group" },
      ];
    case "member_removed":
      if (event.actorDid === event.member) {
        return [
          { text: displayName(event.member, selfDid), emphasis: true },
          { text: " left the group" },
        ];
      }
      return [
        { text: actorName, emphasis: true },
        { text: " removed " },
        { text: displayName(event.member, selfDid), emphasis: true },
        { text: " from the group" },
      ];
    case "group_icon_changed":
      return [
        { text: actorName, emphasis: true },
        { text: " changed the group icon" },
      ];
    case "group_name_changed":
      return [
        { text: actorName, emphasis: true },
        { text: " changed the group name" },
      ];
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function formatSystemEventText(
  event: SystemTimelineEvent,
  selfDid?: string,
): string {
  return systemEventTextParts(event, selfDid)
    .map((part) => part.text)
    .join("");
}

/** Sidebar subtitle from an already-parsed timeline. */
export function previewFromTimeline(
  items: ChatTimelineItem[],
  identity?: string,
): string | undefined {
  if (items.length === 0) return undefined;
  const last = items[items.length - 1];
  if (last.kind === "message") {
    const previewLine = last.body.split("\n")[0] ?? last.body;
    return last.from && last.from !== identity
      ? `${displayName(last.from, identity)}: ${previewLine}`
      : previewLine;
  }
  return formatSystemEventText(last, identity);
}

