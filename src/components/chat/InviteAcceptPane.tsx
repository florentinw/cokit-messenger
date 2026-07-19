import { useState } from "react";
import { displayName, truncateDid, useChatEntry } from "@/lib/messenger";
import { Button } from "@/components/global/Button";
import { GroupAvatar } from "@/components/global/GroupAvatar";

type Props = {
  coId: string;
  /** True while Invite → Join handshake is still completing. */
  pending?: boolean;
  error?: string;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
};

function isResolvedGroupName(coId: string, name?: string): name is string {
  if (!name || name === "Group chat" || name === coId) return false;
  if (name === truncateDid(coId, 22)) return false;
  return true;
}

export function InviteAcceptPane({
  coId,
  pending,
  error,
  onAccept,
  onDecline,
}: Props) {
  const entry = useChatEntry(coId);
  const [acting, setActing] = useState(false);
  const name = isResolvedGroupName(coId, entry?.name) ? entry.name : undefined;
  const inviterDid = entry?.inviterDid;
  const inviterName = inviterDid
    ? displayName(inviterDid)
    : entry?.inviterName;
  const hasName = !!name;
  const title = hasName ? name : truncateDid(coId, 22);
  const inviteHeadline = inviterName
    ? hasName
      ? `${inviterName} invited you to “${name}”`
      : `${inviterName} invited you to this group`
    : hasName
      ? `You’ve been invited to “${name}”`
      : "You’ve been invited to this group";

  async function run(action: () => Promise<void>) {
    if (acting) return;
    setActing(true);
    try {
      await action();
    } finally {
      setActing(false);
    }
  }

  return (
    <section className="content-pane layer-card relative flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between px-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch">
          <div className="flex min-w-0 items-center gap-2">
            <GroupAvatar
              coId={coId}
              color={entry?.color}
              className="size-6 rounded"
              padClassName="p-[15%]"
            />
            <h1 className="type-body truncate text-foreground">{title}</h1>
          </div>
          <div data-tauri-drag-region className="min-w-0 flex-1 self-stretch" aria-hidden />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-8">
        <div className="w-full max-w-sm">
          <h1 className="text-center type-title text-foreground">
            {pending
              ? hasName
                ? `Joining “${name}”…`
                : "Joining this group…"
              : inviteHeadline}
          </h1>

          {pending && (
            <p className="mt-3 text-center type-body-regular text-muted">
              Waiting for membership to become active. This can take a moment when
              both peers are online.
            </p>
          )}

          {error && <p className="mt-4 type-body text-error">{error}</p>}

          {!pending && (
            <div className="mt-8 flex justify-center gap-3">
              <Button
                variant="secondary"
                isDisabled={acting}
                onPress={() => void run(onDecline)}
              >
                Decline
              </Button>
              <Button
                variant="primary"
                isDisabled={acting}
                onPress={() => void run(onAccept)}
              >
                {acting ? "Working…" : "Accept"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
