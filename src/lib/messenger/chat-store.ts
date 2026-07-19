import { useSyncExternalStore } from "react";
import type { CID } from "multiformats";
import {
  getActions,
  getCoState,
  getSharedCoSession,
  invalidateSharedCoSession,
  resolveActionsParallel,
  resolveCid,
} from "../co-sdk";
import {
  isGroupAvatarColor,
  writeGroupAvatarColor,
  type GroupAvatarColor,
} from "./group-avatar";
import {
  avatarColorFromCoTags,
  displayName,
  extractTextMessages,
  extractTimelineItems,
  ingestDisplayNamesFromTags,
  lastActivityTimestamp,
  nameFromCoTags,
  type ChatTimelineItem,
} from "./operations";
import { countUnreadMessages, getLastReadAt, markChatRead } from "./unread";
import type { RoomState } from "./types";

export type ChatStoreEntry = {
  coId: string;
  name: string;
  color?: GroupAvatarColor;
  preview?: string;
  timestamp?: number;
  unread: number;
  /** Inviter display name (pending invites). */
  inviterName?: string;
  /** Bumped on optimistic local edits (name/color). Remote fetches capture this and skip overwriting those fields if it changed mid-flight. */
  localRevision: number;
  /** Resolved reducer actions for the open transcript (raw payloads). */
  actions?: unknown[];
  updatedAt: number;
};

type RemotePatch = {
  name?: string;
  color?: GroupAvatarColor;
  preview?: string;
  timestamp?: number;
  unread?: number;
  actions?: unknown[];
};

const CONCURRENCY = 4;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

class ChatStore {
  private entries = new Map<string, ChatStoreEntry>();
  private listeners = new Set<() => void>();
  private revision = 0;
  /** In-flight refresh generations per co — drop superseded results. */
  private fetchGen = new Map<string, number>();

  subscribe = (onStoreChange: () => void): (() => void) => {
    this.listeners.add(onStoreChange);
    return () => {
      this.listeners.delete(onStoreChange);
    };
  };

  getRevision = (): number => this.revision;

  private emit() {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }

  get(coId: string): ChatStoreEntry | undefined {
    return this.entries.get(coId);
  }

  /** Snapshot for React — new Map reference each revision via getRevision pairing. */
  getAll(): ReadonlyMap<string, ChatStoreEntry> {
    return this.entries;
  }

  remove(coId: string): void {
    if (!this.entries.delete(coId)) return;
    this.fetchGen.delete(coId);
    this.emit();
  }

  /**
   * Optimistic UI write. Bumps localRevision only when name/color change so
   * in-flight remotes can't clobber those fields (unread/transcript updates don't).
   */
  applyLocal(
    coId: string,
    patch: {
      name?: string;
      color?: GroupAvatarColor;
      unread?: number;
      preview?: string;
      timestamp?: number;
      actions?: unknown[];
      inviterName?: string;
    },
  ): void {
    const prev = this.entries.get(coId);
    const nameChanged = patch.name !== undefined && patch.name !== prev?.name;
    const colorChanged =
      patch.color !== undefined && patch.color !== prev?.color;
    const next: ChatStoreEntry = {
      coId,
      name: patch.name ?? prev?.name ?? "Group chat",
      color: patch.color ?? prev?.color,
      preview: patch.preview ?? prev?.preview,
      timestamp: patch.timestamp ?? prev?.timestamp,
      unread: patch.unread ?? prev?.unread ?? 0,
      inviterName: patch.inviterName ?? prev?.inviterName,
      localRevision:
        nameChanged || colorChanged
          ? (prev?.localRevision ?? 0) + 1
          : (prev?.localRevision ?? 0),
      actions: patch.actions ?? prev?.actions,
      updatedAt: Date.now(),
    };
    if (
      prev &&
      prev.name === next.name &&
      prev.color === next.color &&
      prev.preview === next.preview &&
      prev.timestamp === next.timestamp &&
      prev.unread === next.unread &&
      prev.inviterName === next.inviterName &&
      prev.actions === next.actions
    ) {
      return;
    }
    if (patch.color && isGroupAvatarColor(patch.color)) {
      writeGroupAvatarColor(coId, patch.color);
    }
    this.entries.set(coId, next);
    this.emit();
  }

  /**
   * Apply a remote fetch. `capturedLocalRevision` is the revision at fetch start —
   * if the user edited name/color since then, those fields are preserved.
   */
  applyRemote(coId: string, patch: RemotePatch, capturedLocalRevision: number): void {
    const prev = this.entries.get(coId);
    const localMoved = (prev?.localRevision ?? 0) !== capturedLocalRevision;
    const next: ChatStoreEntry = {
      coId,
      name:
        localMoved && prev?.name
          ? prev.name
          : (patch.name ?? prev?.name ?? "Group chat"),
      color: localMoved && prev?.color ? prev.color : (patch.color ?? prev?.color),
      preview: patch.preview ?? prev?.preview,
      timestamp: patch.timestamp ?? prev?.timestamp,
      unread: patch.unread ?? prev?.unread ?? 0,
      inviterName: prev?.inviterName,
      localRevision: prev?.localRevision ?? 0,
      actions: patch.actions ?? prev?.actions,
      updatedAt: Date.now(),
    };
    // Avoid no-op emits when nothing meaningful changed.
    if (
      prev &&
      prev.name === next.name &&
      prev.color === next.color &&
      prev.preview === next.preview &&
      prev.timestamp === next.timestamp &&
      prev.unread === next.unread &&
      prev.inviterName === next.inviterName &&
      prev.actions === next.actions
    ) {
      return;
    }
    if (next.color && (!prev || prev.color !== next.color)) {
      writeGroupAvatarColor(coId, next.color);
    }
    this.entries.set(coId, next);
    this.emit();
  }

  beginFetch(coId: string): { gen: number; localRevision: number } {
    const gen = (this.fetchGen.get(coId) ?? 0) + 1;
    this.fetchGen.set(coId, gen);
    return { gen, localRevision: this.entries.get(coId)?.localRevision ?? 0 };
  }

  isFetchCurrent(coId: string, gen: number): boolean {
    return this.fetchGen.get(coId) === gen;
  }
}

export const chatStore = new ChatStore();

export function useChatStoreRevision(): number {
  return useSyncExternalStore(
    chatStore.subscribe,
    chatStore.getRevision,
    () => 0,
  );
}

export function useChatEntry(coId: string | undefined): ChatStoreEntry | undefined {
  const revision = useChatStoreRevision();
  void revision;
  return coId ? chatStore.get(coId) : undefined;
}

export function timelineFromEntry(entry: ChatStoreEntry | undefined): ChatTimelineItem[] {
  if (!entry?.actions?.length) return [];
  return extractTimelineItems(entry.actions);
}

/**
 * Load name / color / preview / unread (and optionally actions) from CO into the store.
 * Invalidates the shared session on hard failures.
 */
export async function refreshChatFromCo(
  coId: string,
  identity: string | undefined,
  opts?: {
    includeActions?: boolean;
    actionCount?: number;
    /** When true, mark unread 0 for this co (open chat). */
    selected?: boolean;
    /** Prefer event payload over a fresh getCoState round-trip. */
    stateCid?: CID;
    heads?: CID[];
  },
): Promise<void> {
  const { gen, localRevision } = chatStore.beginFetch(coId);
  try {
    const session = await getSharedCoSession(coId);
    let stateCid = opts?.stateCid;
    let heads = opts?.heads;
    if (stateCid === undefined || heads === undefined) {
      const fetched = await getCoState(coId);
      stateCid ??= fetched[0];
      heads ??= fetched[1];
    }
    if (!chatStore.isFetchCurrent(coId, gen)) return;
    if (!stateCid) return;

    const co = (await resolveCid(session, stateCid)) as {
      n?: string;
      t?: unknown;
      c?: Record<string, { state?: CID }>;
    };
    if (!chatStore.isFetchCurrent(coId, gen)) return;

    const roomCid = co.c?.room?.state;
    const tagName = nameFromCoTags(co.t);
    const tagColor = avatarColorFromCoTags(co.t);
    ingestDisplayNamesFromTags(co.t);
    let name = tagName || (typeof co.n === "string" ? co.n : undefined) || "Group chat";
    if (!tagName && roomCid) {
      try {
        const room = (await resolveCid(session, roomCid)) as RoomState;
        if (room?.name) name = room.name;
      } catch {
        // keep tag/co name
      }
    }

    const actionCount = opts?.actionCount ?? (opts?.includeActions ? 200 : 50);
    const actionsResponse = await getActions(session, heads, actionCount, undefined);
    if (!chatStore.isFetchCurrent(coId, gen)) return;

    const resolvedActions = await resolveActionsParallel(
      session,
      actionsResponse.actions as CID[],
      { cache: false },
    );
    if (!chatStore.isFetchCurrent(coId, gen)) return;

    const messages = extractTextMessages(resolvedActions);
    const last = messages.length > 0 ? messages[messages.length - 1] : undefined;
    const activityAt = lastActivityTimestamp(resolvedActions) ?? last?.timestamp;

    let lastRead = getLastReadAt(coId);
    if (opts?.selected) {
      const at = activityAt ?? Date.now();
      markChatRead(coId, at);
      lastRead = at;
    } else if (lastRead === undefined) {
      // Never opened — count peer messages as unread (don't silently baseline).
      lastRead = 0;
    }

    const unread = opts?.selected
      ? 0
      : countUnreadMessages(messages, identity, lastRead);

    let preview: string | undefined;
    if (last) {
      const previewLine = last.body.split("\n")[0] ?? last.body;
      preview =
        last.from && last.from !== identity
          ? `${displayName(last.from, identity)}: ${previewLine}`
          : previewLine;
    }

    chatStore.applyRemote(
      coId,
      {
        name,
        color: tagColor,
        preview,
        timestamp: activityAt,
        unread,
        actions: opts?.includeActions ? resolvedActions : undefined,
      },
      localRevision,
    );
  } catch (err) {
    console.warn(`refreshChatFromCo failed for ${coId}`, err);
    invalidateSharedCoSession(coId);
  }
}

/** Hydrate many chats with bounded parallelism. */
export async function refreshChatsFromCo(
  coIds: string[],
  identity: string | undefined,
  opts?: { selectedId?: string },
): Promise<void> {
  await mapPool(coIds, CONCURRENCY, (coId) =>
    refreshChatFromCo(coId, identity, {
      selected: opts?.selectedId === coId,
      includeActions: opts?.selectedId === coId,
    }),
  );
}
