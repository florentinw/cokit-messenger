import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useCo,
  useCoCore,
  useCoSession,
  useCoStateRevision,
  useResolveCid,
  resolveCid,
} from "../../lib/co-sdk-extras";
import {
  dateChipLabel,
  ensureRoomCore,
  refreshChatFromCo,
  sendTextMessage,
  setRoomName,
  timelineFromEntry,
  useChatEntry,
  type RoomState,
} from "../../lib/messenger";
import { useOverflowHeaderBorder } from "../../lib/useOverflowHeaderBorder";
import { cn } from "../../lib/utils";
import { Composer } from "./Composer";
import { GroupAvatar } from "../global/GroupAvatar";
import { Button } from "../global/Button";
import { Icon } from "../global/icons/Icon";
import { MessageBubble, type MessageCluster } from "./MessageBubble";
import { SystemEventBubble } from "./SystemEventBubble";

type TimelineItem = ReturnType<typeof timelineFromEntry>[number];

function messageCluster(items: TimelineItem[], index: number): MessageCluster {
  const item = items[index];
  if (item.kind !== "message") return "standalone";
  const prev = items[index - 1];
  const next = items[index + 1];
  const samePrev = prev?.kind === "message" && prev.from === item.from;
  const sameNext = next?.kind === "message" && next.from === item.from;
  if (!samePrev && !sameNext) return "standalone";
  if (!samePrev && sameNext) return "first";
  if (samePrev && sameNext) return "middle";
  return "last";
}

function itemSpacingClass(
  items: TimelineItem[],
  index: number,
  cluster: MessageCluster,
): string {
  if (index === 0) return "";
  const item = items[index];
  const prev = items[index - 1];
  if (item.kind === "system") {
    return prev?.kind === "system" ? "mt-1" : "mt-3";
  }
  if (cluster === "middle" || cluster === "last") return "mt-0.5";
  return "mt-2";
}

type Props = {
  coId: string;
  identity?: string;
  fallbackName?: string;
  onOpenDetails: () => void;
  /** Called when the open chat’s latest message timestamp advances (mark read). */
  onMessagesSeen?: (latestTimestamp: number) => void;
};

export function ChatPane({
  coId,
  identity,
  fallbackName,
  onOpenDetails,
  onMessagesSeen,
}: Props) {
  const entry = useChatEntry(coId);
  const { sessionId: session, error: sessionError } = useCoSession(coId);
  const [coCid, heads] = useCo(coId);
  const roomCoreCid = useCoCore(coCid, "room", session, coId, heads);
  const room = useResolveCid<RoomState>(roomCoreCid, session, coId, heads);
  const stateRevision = useCoStateRevision(coId);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [ready, setReady] = useState(false);
  const [composerError, setComposerError] = useState<string>();

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
        if (!cancelled) {
          setComposerError(
            err instanceof Error
              ? err.message
              : "Failed to set up this chat room.",
          );
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
    // fallbackName is only used when creating the room core — don't re-run bootstrap when meta hydrates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, identity, coCid, coId]);

  // Reset ready only when switching chats — not when fallbackName loads.
  useEffect(() => {
    setReady(false);
    setComposerError(undefined);
  }, [coId]);

  // ChatStore is the only transcript writer — refresh when heads / state change.
  useEffect(() => {
    if (heads === undefined) return;
    void refreshChatFromCo(coId, identity, {
      includeActions: true,
      selected: true,
      heads,
    });
  }, [coId, identity, heads, stateRevision]);

  const timeline = useMemo(() => timelineFromEntry(entry), [entry]);

  useEffect(() => {
    if (!onMessagesSeen) return;
    let latest = 0;
    for (const item of timeline) {
      if (item.kind === "message" && item.timestamp > latest) {
        latest = item.timestamp;
      }
    }
    if (latest > 0) onMessagesSeen(latest);
  }, [timeline, onMessagesSeen]);

  const title = entry?.name || room?.name || fallbackName || "Chat";

  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: typeof timeline }> = [];
    for (const item of timeline) {
      const label = dateChipLabel(item.timestamp);
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) groups.push({ label, items: [item] });
      else last.items.push(item);
    }
    return groups;
  }, [timeline]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  const headerBorder = useOverflowHeaderBorder(
    scrollRef,
    `${timeline.length}:${coId}`,
  );

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const isNearBottom = useCallback((threshold = 80) => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      wasNearBottomRef.current = isNearBottom();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  useEffect(() => {
    wasNearBottomRef.current = true;
    forceScrollRef.current = true;
    requestAnimationFrame(() => scrollToBottom());
  }, [coId, scrollToBottom]);

  useEffect(() => {
    if (forceScrollRef.current || wasNearBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom());
    }
    forceScrollRef.current = false;
  }, [timeline.length, scrollToBottom]);

  return (
    <section className="content-pane layer-card relative flex h-full min-w-0 flex-1 flex-col">
      <header
        className={cn(
          "flex h-12 shrink-0 items-center justify-between bg-surface pl-3.5 pr-2.5",
          headerBorder && "border-b border-separator",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch">
          <Button
            variant="bare"
            onPress={onOpenDetails}
            className="interactive flex h-auto min-w-0 items-center gap-1.5 rounded-md border-0 bg-transparent pr-2 text-left"
            aria-label={`Group settings for ${title}`}
          >
            <GroupAvatar
              coId={coId}
              color={entry?.color}
              className="size-6 rounded"
              padClassName="p-[15%]"
            />
            <h1 className="type-body truncate text-foreground">{title}</h1>
          </Button>
          <div
            data-tauri-drag-region
            className="min-w-0 flex-1 self-stretch"
            aria-hidden
          />
        </div>
        <Button
          variant="icon"
          onPress={onOpenDetails}
          aria-label="Group details"
        >
          <Icon name="info" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col pb-4">
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-6"
        >
          <div className="mt-auto flex flex-col gap-5 px-4">
            <div className="mb-2 flex flex-col items-center gap-4">
              <GroupAvatar
                coId={coId}
                color={entry?.color}
                className="size-[52px]"
                padClassName="p-[18%]"
              />
              <p className="type-title text-foreground">Welcome to {title}!</p>
            </div>

            {grouped.length === 0 && (
              <p className="text-center type-body-regular text-muted">
                {bootstrapping
                  ? "Setting up room…"
                  : "No messages yet. Say hi!"}
              </p>
            )}
            {grouped.map((group) => (
              <div key={group.label} className="flex flex-col gap-4">
                <div className="flex justify-center">
                  <span className="layer-inset rounded-full bg-surface px-3 py-0.5 type-caption text-muted">
                    {group.label}
                  </span>
                </div>
                <div className="flex flex-col">
                  {group.items.map((item, index) => {
                    const cluster =
                      item.kind === "message"
                        ? messageCluster(group.items, index)
                        : "standalone";
                    const spacing = itemSpacingClass(
                      group.items,
                      index,
                      cluster,
                    );
                    return item.kind === "system" ? (
                      <div key={item.eventId} className={spacing}>
                        <SystemEventBubble event={item} identity={identity} />
                      </div>
                    ) : (
                      <div key={item.eventId} className={spacing}>
                        <MessageBubble
                          body={item.body}
                          from={item.from}
                          mine={item.from === identity}
                          identity={identity}
                          cluster={cluster}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 shrink-0 px-4">
          <Composer
            disabled={!session || !identity || !coCid || bootstrapping}
            error={
              composerError ??
              (sessionError
                ? `Chat session unavailable: ${sessionError.message}`
                : undefined)
            }
            placeholder={`Message to ${title}`}
            onSend={async (text) => {
              if (!session || !identity || !coCid) {
                throw new Error("Chat session or identity is not ready yet.");
              }
              setComposerError(undefined);
              forceScrollRef.current = true;
              if (!ready) {
                const resolved = (await resolveCid(session, coCid)) as {
                  c?: Record<string, unknown>;
                  n?: string;
                };
                if (resolved?.c?.room === undefined) {
                  await ensureRoomCore(session, identity);
                  const name = fallbackName || resolved?.n || "Group chat";
                  await setRoomName(session, identity, coId, name);
                }
                setReady(true);
              }
              await sendTextMessage(session, identity, coId, text);
              await refreshChatFromCo(coId, identity, {
                includeActions: true,
                selected: true,
              });
            }}
          />
        </div>
      </div>
    </section>
  );
}
