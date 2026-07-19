import { useEffect, useMemo, useState } from "react";
import type { CID } from "multiformats";
import {
  useCo,
  useCoActions,
  useCoCore,
  useCoSession,
  useResolveCid,
  resolveCid,
  type MatrixEvent,
  type ReducerAction,
  type RoomState,
} from "../lib/co-sdk";
import {
  avatarForCo,
  dateChipLabel,
  ensureRoomCore,
  extractTextMessages,
  sendTextMessage,
  setRoomName,
} from "../lib/messenger";
import { Composer } from "./Composer";
import { Icon } from "./Icon";
import { MessageBubble } from "./MessageBubble";

type Props = {
  coId: string;
  identity?: string;
  fallbackName?: string;
  onOpenDetails: () => void;
};

export function ChatPane({ coId, identity, fallbackName, onOpenDetails }: Props) {
  const { sessionId: session } = useCoSession(coId);
  const [coCid, heads] = useCo(coId);
  const roomCoreCid = useCoCore(coCid, "room", session, coId, heads);
  const room = useResolveCid<RoomState>(roomCoreCid, session, coId, heads);
  const actionsResponse = useCoActions(heads, session, 200);
  const [resolvedActions, setResolvedActions] = useState<unknown[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!session || !identity || !coCid) return;
      setBootstrapping(true);
      try {
        const resolved = (await resolveCid(session, coCid)) as {
          c?: Record<string, unknown>;
          n?: string;
        };
        if (resolved?.c?.room === undefined) {
          await ensureRoomCore(session, identity);
          const name = fallbackName || resolved?.n || "Group chat";
          await setRoomName(session, identity, coId, name);
        }
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error("Failed to ensure room core", err);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [session, identity, coCid, coId, fallbackName]);

  useEffect(() => {
    let cancelled = false;
    async function loadActions() {
      if (!session || !actionsResponse?.actions?.length) {
        setResolvedActions([]);
        return;
      }
      const items: unknown[] = [];
      for (const cid of actionsResponse.actions) {
        try {
          items.push(await resolveCid(session, cid as CID));
        } catch (err) {
          console.error("Failed to resolve action", err);
        }
      }
      if (!cancelled) setResolvedActions(items);
    }
    void loadActions();
    return () => {
      cancelled = true;
    };
  }, [session, actionsResponse]);

  const messages = useMemo(
    () => extractTextMessages(resolvedActions as Array<ReducerAction<MatrixEvent>>),
    [resolvedActions],
  );

  const title = room?.name || fallbackName || "Chat";
  const avatar = avatarForCo(coId);

  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: typeof messages }> = [];
    for (const msg of messages) {
      const label = dateChipLabel(msg.timestamp);
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) groups.push({ label, items: [msg] });
      else last.items.push(msg);
    }
    return groups;
  }, [messages]);

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col bg-bg-base">
      <header
        data-tauri-drag-region
        className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3.5"
      >
        <div className="flex items-center gap-2">
          <div className="size-6 overflow-hidden rounded border-[0.5px] border-border bg-bg-elevated p-1">
            <img src={avatar} alt="" className="size-full" />
          </div>
          <h1 className="text-[14px] font-medium tracking-[-0.14px] text-primary">{title}</h1>
        </div>
        <button type="button" onClick={onOpenDetails} aria-label="Group details" className="btn-icon">
          <Icon name="info" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="size-[52px] overflow-hidden rounded-lg bg-bg-elevated p-2.5">
            <img src={avatar} alt="" className="size-full" />
          </div>
          <p className="text-[20px] font-semibold tracking-[-0.3px] text-primary">
            Welcome to {title}!
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
          {grouped.length === 0 && (
            <p className="text-center text-[14px] text-secondary">
              {bootstrapping ? "Setting up room…" : "No messages yet. Say hi!"}
            </p>
          )}
          {grouped.map((group) => (
            <div key={group.label} className="flex flex-col gap-4">
              <div className="flex justify-center">
                <span className="rounded-full bg-bg-elevated px-3 py-0.5 text-[12px] font-medium tracking-[-0.12px] text-secondary">
                  {group.label}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {group.items.map((msg) => (
                  <MessageBubble
                    key={msg.eventId}
                    body={msg.body}
                    from={msg.from}
                    mine={msg.from === identity}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 shrink-0">
          <Composer
            disabled={!session || !identity || (!ready && !roomCoreCid)}
            onSend={async (text) => {
              if (!session || !identity) return;
              await sendTextMessage(session, identity, coId, text);
            }}
          />
        </div>
      </div>
    </section>
  );
}
