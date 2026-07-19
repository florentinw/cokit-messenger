import { v4 as uuid } from "uuid";
import { CID } from "multiformats";
import { create as createDigest } from "multiformats/hashes/digest";
import {
  CO_CORE_NAME_MEMBERSHIP,
  CO_CORE_NAME_ROOM,
  IDENTITY_NAME,
  MembershipState,
  type CoSdkStateEvent,
  type GetActionsResponse,
  type MatrixEvent,
  type Membership,
  type MembershipsAction,
  type ReducerAction,
} from "./types";

export const MOCK_IDENTITY = "did:key:zMockMessengerIdentity";
const MOCK_PEER = "did:key:zMockTeammate";

const CO_LOCAL = "local";
const CO_DESIGN = "co:mock-design";
const CO_WEEKEND = "co:mock-weekend";

const cidCache = new Map<string, CID>();

function mockDigest(key: string): Uint8Array {
  const bytes = new TextEncoder().encode(key);
  const out = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    out[i % 32] ^= bytes[i];
    out[(i + 7) % 32] = (out[(i + 7) % 32] + bytes[i]) & 0xff;
  }
  return out;
}

function mockCid(key: string): CID {
  const cached = cidCache.get(key);
  if (cached) return cached;
  const cid = CID.create(1, 0x71, createDigest(0x12, mockDigest(key)));
  cidCache.set(key, cid);
  return cid;
}

type MockCo = {
  id: string;
  name: string;
  stateCid: CID;
  heads: CID[];
  actionCids: CID[];
};

class MockCoStore {
  private readonly objects = new Map<string, unknown>();
  private readonly cos = new Map<string, MockCo>();
  private readonly openSessions = new Map<string, Set<string>>();
  private sessionCounter = 0;
  private readonly stateListeners = new Set<(event: CoSdkStateEvent) => void>();

  constructor() {
    this.seed();
  }

  private put(cid: CID, value: unknown) {
    this.objects.set(cid.toString(), value);
  }

  private get<T>(cid: CID): T {
    return this.objects.get(cid.toString()) as T;
  }

  private seed() {
    const keysCid = mockCid("keystore-keys");
    const keystoreStateCid = mockCid("keystore-state");
    const membershipStateCid = mockCid("local-membership-state");
    const localStateCid = mockCid("local-co-state");

    this.put(keysCid, {
      a: {
        l: [[MOCK_IDENTITY, { v: { name: IDENTITY_NAME } }]],
      },
    });
    this.put(keystoreStateCid, { keys: keysCid });
    this.put(membershipStateCid, {
      memberships: [
        this.membership(CO_DESIGN, MOCK_IDENTITY, MembershipState.Active),
        this.membership(CO_WEEKEND, MOCK_IDENTITY, MembershipState.Active),
      ],
    });
    this.put(localStateCid, {
      c: {
        keystore: { state: keystoreStateCid },
        membership: { state: membershipStateCid },
      },
    });

    this.cos.set(CO_LOCAL, {
      id: CO_LOCAL,
      name: "local",
      stateCid: localStateCid,
      heads: [localStateCid],
      actionCids: [],
    });

    this.seedChat(CO_DESIGN, "Design", [
      {
        from: MOCK_IDENTITY,
        body: "Hey team, how's the sidebar looking?",
        offsetMs: -1000 * 60 * 45,
      },
      {
        from: MOCK_PEER,
        body: "Pretty good — spacing tweaks next.",
        offsetMs: -1000 * 60 * 12,
      },
    ]);

    this.seedChat(CO_WEEKEND, "Weekend plans", [
      {
        from: MOCK_IDENTITY,
        body: "Brunch Saturday?",
        offsetMs: -1000 * 60 * 90,
      },
    ]);
  }

  private membership(id: string, did: string, state: MembershipState): Membership {
    return { id, did: { [did]: state } };
  }

  private seedChat(
    coId: string,
    name: string,
    messages: Array<{ from: string; body: string; offsetMs: number }>,
  ) {
    const roomStateCid = mockCid(`${coId}-room-state`);
    const stateCid = mockCid(`${coId}-co-state`);
    const actionCids: CID[] = [];
    const heads: CID[] = [];

    this.put(roomStateCid, {
      name,
      description: "",
      pinned_messages: [],
    });
    this.put(stateCid, {
      n: name,
      c: {
        room: { state: roomStateCid },
      },
    });

    for (const [index, msg] of messages.entries()) {
      const actionCid = mockCid(`${coId}-msg-${index}`);
      const event: MatrixEvent = {
        event_id: uuid(),
        room_id: coId,
        timestamp: Date.now() + msg.offsetMs,
        type: "m_room_message",
        content: { msgtype: "text", body: msg.body },
      };
      const action: ReducerAction<MatrixEvent> = {
        from: msg.from,
        payload: event,
        time: event.timestamp,
      };
      this.put(actionCid, action);
      actionCids.push(actionCid);
      heads.push(actionCid);
    }

    this.cos.set(coId, {
      id: coId,
      name,
      stateCid,
      heads,
      actionCids,
    });
  }

  private emitState(coId: string) {
    const co = this.cos.get(coId);
    if (!co) return;
    const event: CoSdkStateEvent = [coId, co.stateCid, [...co.heads]];
    for (const listener of this.stateListeners) listener(event);
  }

  private coForSession(sessionId: string, coId: string): MockCo {
    const allowed = this.openSessions.get(sessionId);
    if (!allowed?.has(coId)) {
      throw new Error(`Mock session ${sessionId} is not open for ${coId}`);
    }
    const co = this.cos.get(coId);
    if (!co) throw new Error(`Unknown mock CO ${coId}`);
    return co;
  }

  sessionOpen(coId: string): string {
    const sessionId = `mock-session-${++this.sessionCounter}`;
    this.openSessions.set(sessionId, new Set([coId]));
    return sessionId;
  }

  sessionClose(sessionId: string): void {
    this.openSessions.delete(sessionId);
  }

  getCoState(coId: string): [CID | undefined, CID[]] {
    const co = this.cos.get(coId);
    if (!co) return [undefined, []];
    return [co.stateCid, [...co.heads]];
  }

  resolveCid(_session: string, cid: CID): unknown {
    const value = this.objects.get(cid.toString());
    if (value === undefined) throw new Error(`Mock CID not found: ${cid.toString()}`);
    return value;
  }

  getActions(
    session: string,
    heads: CID[],
    count: number,
    until: CID | undefined,
  ): GetActionsResponse {
    void until;
    const coId = this.coIdForHeads(heads) ?? this.coIdForSession(session);
    const co = coId ? this.cos.get(coId) : undefined;
    const actions = co ? co.actionCids.slice(-count) : [];
    return { actions, next_heads: co ? [...co.heads] : [] };
  }

  private coIdForSession(session: string): string | undefined {
    const allowed = this.openSessions.get(session);
    if (!allowed) return undefined;
    return [...allowed][0];
  }

  private coIdForHeads(heads: CID[]): string | undefined {
    if (heads.length === 0) return undefined;
    for (const [coId, co] of this.cos) {
      if (co.heads.some((head) => heads.some((h) => h.equals(head)))) return coId;
      if (heads.some((h) => h.equals(co.stateCid))) return coId;
    }
    return undefined;
  }

  pushAction(
    session: string,
    core: string,
    action: unknown,
    identity: string,
  ): CID | undefined {
    if (core === CO_CORE_NAME_MEMBERSHIP) {
      return this.pushMembershipAction(session, action as MembershipsAction, identity);
    }

    const coId = this.findCoIdForSession(session, core);
    if (!coId) return undefined;
    const co = this.coForSession(session, coId);

    if (this.isCoreCreate(action)) {
      const roomStateCid = mockCid(`${coId}-room-state-${co.actionCids.length}`);
      this.put(roomStateCid, {
        name: co.name,
        description: "",
        pinned_messages: [],
      });
      const state = this.get<{ c?: Record<string, { state?: CID }>; n?: string }>(co.stateCid);
      state.c = { ...state.c, room: { state: roomStateCid } };
      this.put(co.stateCid, state);
      this.emitState(coId);
      return co.stateCid;
    }

    const matrixEvent = this.asMatrixEvent(action);
    if (matrixEvent && core === CO_CORE_NAME_ROOM) {
      const actionCid = mockCid(`${coId}-action-${co.actionCids.length}`);
      const wrapped: ReducerAction<MatrixEvent> = {
        from: identity,
        payload: matrixEvent,
        time: matrixEvent.timestamp,
      };
      this.put(actionCid, wrapped);
      co.actionCids.push(actionCid);
      co.heads.push(actionCid);

      if (matrixEvent.type === "room_name") {
        const state = this.get<{ n?: string; c?: Record<string, { state?: CID }> }>(co.stateCid);
        state.n = matrixEvent.content.name;
        this.put(co.stateCid, state);
        const roomCore = state.c?.room?.state;
        if (roomCore) {
          const roomState = this.get<{ name: string }>(roomCore);
          roomState.name = matrixEvent.content.name;
          this.put(roomCore, roomState);
        }
      }

      this.emitState(coId);
      return actionCid;
    }

    return undefined;
  }

  private isCoreCreate(action: unknown): action is { CoreCreate: { core: string } } {
    return (
      typeof action === "object" &&
      action !== null &&
      "CoreCreate" in action &&
      typeof (action as { CoreCreate?: { core?: string } }).CoreCreate?.core === "string"
    );
  }

  private asMatrixEvent(action: unknown): MatrixEvent | undefined {
    if (typeof action !== "object" || action === null) return undefined;
    const candidate = action as MatrixEvent;
    if (typeof candidate.type === "string" && typeof candidate.event_id === "string") {
      return candidate;
    }
    return undefined;
  }

  private findCoIdForSession(session: string, core: string): string | undefined {
    void core;
    const allowed = this.openSessions.get(session);
    if (!allowed) return undefined;
    for (const coId of allowed) {
      if (coId !== CO_LOCAL) return coId;
    }
    return undefined;
  }

  private commitLocalMembershipState(memberships: Membership[]): void {
    const local = this.cos.get(CO_LOCAL);
    if (!local) return;

    const newMembershipStateCid = mockCid(`local-membership-state-${uuid()}`);
    this.put(newMembershipStateCid, { memberships });

    const localState = this.get<{ c?: Record<string, { state?: CID }> }>(local.stateCid);
    localState.c = {
      ...localState.c,
      membership: { state: newMembershipStateCid },
    };

    const newLocalStateCid = mockCid(`local-co-state-${uuid()}`);
    this.put(newLocalStateCid, localState);
    local.stateCid = newLocalStateCid;
    local.heads = [newLocalStateCid];
    this.emitState(CO_LOCAL);
  }

  private pushMembershipAction(
    session: string,
    action: MembershipsAction,
    _identity: string,
  ): CID | undefined {
    this.coForSession(session, CO_LOCAL);
    const local = this.cos.get(CO_LOCAL);
    if (!local) return undefined;

    const membershipStateCid = this.get<{ c?: { membership?: { state?: CID } } }>(
      local.stateCid,
    ).c?.membership?.state;
    if (!membershipStateCid) return undefined;

    const membershipState = this.get<{ memberships?: Membership[] }>(membershipStateCid);
    const memberships = [...(membershipState.memberships ?? [])];

    if ("Join" in action) {
      const { id, did } = action.Join;
      const existing = memberships.find((m) => m.id === id);
      if (existing) {
        existing.did = { ...existing.did, [did]: MembershipState.Active };
      } else {
        memberships.push(this.membership(id, did, MembershipState.Active));
      }
    } else if ("Deactivate" in action) {
      const { id, did } = action.Deactivate;
      const existing = memberships.find((m) => m.id === id);
      if (existing) existing.did = { ...existing.did, [did]: MembershipState.Inactive };
    }

    this.commitLocalMembershipState(memberships);
    return membershipStateCid;
  }

  createIdentity(name: string): string {
    void name;
    return MOCK_IDENTITY;
  }

  createCo(creatorDid: string, coName: string, _isPublic: boolean, coId?: string): string {
    void creatorDid;
    const id = coId ?? `co:mock-${coName.toLowerCase().replace(/\s+/g, "-")}-${uuid().slice(0, 8)}`;
    const roomStateCid = mockCid(`${id}-room-state`);
    const stateCid = mockCid(`${id}-co-state`);

    this.put(roomStateCid, {
      name: coName,
      description: "",
      pinned_messages: [],
    });
    this.put(stateCid, {
      n: coName,
      c: {
        room: { state: roomStateCid },
      },
    });

    this.cos.set(id, {
      id,
      name: coName,
      stateCid,
      heads: [stateCid],
      actionCids: [],
    });

    const local = this.cos.get(CO_LOCAL);
    if (local) {
      const membershipStateCid = this.get<{ c?: { membership?: { state?: CID } } }>(
        local.stateCid,
      ).c?.membership?.state;
      if (membershipStateCid) {
        const membershipState = this.get<{ memberships?: Membership[] }>(membershipStateCid);
        this.commitLocalMembershipState([
          ...(membershipState.memberships ?? []),
          this.membership(id, MOCK_IDENTITY, MembershipState.Active),
        ]);
      }
    }

    return id;
  }

  listenCoSdkState(onEvent: (event: CoSdkStateEvent) => void): () => void {
    this.stateListeners.add(onEvent);
    for (const [coId, co] of this.cos) {
      onEvent([coId, co.stateCid, [...co.heads]]);
    }
    return () => {
      this.stateListeners.delete(onEvent);
    };
  }
}

let mockStoreInstance: MockCoStore | undefined;

function getMockStore(): MockCoStore {
  mockStoreInstance ??= new MockCoStore();
  return mockStoreInstance;
}

/** Lazily initialized so importing invoke.ts in the browser does not crash Tauri mode. */
export const mockStore: MockCoStore = new Proxy({} as MockCoStore, {
  get(_target, prop, receiver) {
    return Reflect.get(getMockStore(), prop, receiver);
  },
});

export function isMockCoEnabled(): boolean {
  const flag = import.meta.env.VITE_MOCK_CO;
  return flag === "1" || flag === "true";
}
