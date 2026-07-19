import { useEffect, useRef, useState, type FormEvent } from "react";
import { type GroupAvatarColor } from "../../lib/messenger";
import { useOverflowHeaderBorder } from "../../lib/useOverflowHeaderBorder";
import { cn } from "../../lib/utils";
import { Button } from "../global/Button";
import { GroupAvatarColorPicker } from "../global/GroupAvatar";
import { Icon } from "../global/icons/Icon";
import { ParticipantLabel } from "../global/ParticipantLabel";
import { InviteParticipantDialog } from "./InviteParticipantDialog";

type Props = {
  identity?: string;
  busy?: boolean;
  error?: string;
  name: string;
  avatarColor: GroupAvatarColor;
  onNameChange: (name: string) => void;
  onAvatarColorChange: (color: GroupAvatarColor) => void;
  onClose: () => void;
  onCreate: (
    name: string,
    avatarColor: GroupAvatarColor,
    inviteeDids: string[],
  ) => Promise<void>;
};

export function NewGroupPanel({
  identity,
  busy,
  error,
  name,
  avatarColor,
  onNameChange,
  onAvatarColorChange,
  onClose,
  onCreate,
}: Props) {
  const [invitees, setInvitees] = useState<string[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const canCreate = name.trim().length > 0 && !!identity && !busy;
  const canInvite = !!identity && !busy;
  const scrollRef = useRef<HTMLFormElement>(null);
  const headerBorder = useOverflowHeaderBorder(
    scrollRef,
    `${invitees.length}:${name}:${avatarColor}:${error ?? ""}`,
  );

  useEffect(() => {
    setInvitees([]);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    await onCreate(name.trim(), avatarColor, invitees);
  }

  async function handleInvite(inviteeDid: string) {
    if (invitees.includes(inviteeDid)) {
      throw new Error("That participant is already on the invite list.");
    }
    setInvitees((prev) => [...prev, inviteeDid]);
  }

  return (
    <section className="content-pane layer-card relative flex h-full min-w-0 flex-1 flex-col">
      <header
        className={cn(
          "flex h-12 shrink-0 items-center gap-2 bg-surface px-2.5",
          headerBorder && "border-b border-separator",
        )}
      >
        <Button variant="icon" onPress={onClose} aria-label="Back">
          <Icon name="back" />
        </Button>
        <div
          data-tauri-drag-region
          className="flex min-w-0 flex-1 items-center self-stretch"
        >
          <h1 className="type-body text-foreground">
            New Group
          </h1>
        </div>
        <Button
          type="submit"
          form="new-group-form"
          variant="primary"
          isDisabled={!canCreate}
        >
          {busy ? "Creating…" : "Create"}
        </Button>
      </header>

      <form
        id="new-group-form"
        ref={scrollRef}
        onSubmit={(e) => void onSubmit(e)}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="mt-8">
          <GroupAvatarColorPicker color={avatarColor} onChange={onAvatarColorChange} />
        </div>

        <div className="mt-10 px-4">
          <label className="block px-1 pb-1 type-caption text-muted">
            Group name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Group name"
            className="type-body input-pill border-foreground placeholder:text-muted"
          />
        </div>

        <div className="mt-6 flex flex-col">
          <p className="px-5 pb-1 type-body-regular text-muted">
            Participants
          </p>
          <div className="px-4">
            <Button
              variant="secondary"
              isDisabled={!canInvite}
              onPress={() => setInviteDialogOpen(true)}
              className="w-full gap-1"
              aria-label="Invite participant"
            >
              <Icon name="plus" />
              Invite participant
            </Button>
          </div>

          <div className="px-4">
            {identity && (
              <div className="mt-2 flex items-center justify-between border-b border-separator py-2">
                <div className="flex items-center gap-3">
                  <div className="avatar-face flex size-8 items-center justify-center overflow-hidden rounded-full layer-inset bg-surface text-muted">
                    <Icon name="user" className="size-4" />
                  </div>
                  <ParticipantLabel did={identity} identity={identity} />
                </div>
                <span className="type-body-regular text-muted">You</span>
              </div>
            )}

            {invitees.map((did) => (
              <div
                key={did}
                className="flex items-center justify-between border-b border-separator py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="avatar-face flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full layer-inset bg-surface text-muted">
                    <Icon name="user" className="size-4" />
                  </div>
                  <ParticipantLabel did={did} />
                </div>
                <Button
                  variant="bare"
                  isDisabled={busy}
                  onPress={() =>
                    setInvitees((prev) => prev.filter((entry) => entry !== did))
                  }
                  className="shrink-0 type-body-regular text-muted"
                  aria-label={`Remove ${did}`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 px-4 type-body text-error">{error}</p>
        )}
        {!identity && (
          <p className="mt-4 px-4 type-body-regular text-muted">
            Creating your local ID (did:key) so you can join chats — Create unlocks
            when it’s ready.
          </p>
        )}
      </form>

      <InviteParticipantDialog
        open={inviteDialogOpen}
        identity={identity}
        onClose={() => setInviteDialogOpen(false)}
        onInvite={handleInvite}
      />
    </section>
  );
}
