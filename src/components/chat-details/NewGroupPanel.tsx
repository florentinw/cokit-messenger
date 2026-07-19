import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_GROUP_AVATAR_COLOR,
  type GroupAvatarColor,
} from "../../lib/messenger";
import { useOverflowHeaderBorder } from "../../lib/useOverflowHeaderBorder";
import { Button } from "../global/Button";
import {
  ContentPaneHeader,
  ContentPaneShell,
} from "../global/ContentPaneHeader";
import { GroupAvatarColorPicker } from "../global/GroupAvatar";
import { Icon } from "../global/icons/Icon";
import { ParticipantRow } from "../global/ParticipantRow";
import { InviteParticipantDialog } from "./InviteParticipantDialog";

export type CreateDraft = {
  name: string;
  color: GroupAvatarColor;
};

type Props = {
  identity?: string;
  error?: string;
  onDraftChange?: (draft: CreateDraft) => void;
  onClose: () => void;
  onCreate: (
    name: string,
    avatarColor: GroupAvatarColor,
    inviteeDids: string[],
  ) => Promise<void>;
};

export function NewGroupPanel({
  identity,
  error,
  onDraftChange,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState<GroupAvatarColor>(
    DEFAULT_GROUP_AVATAR_COLOR,
  );
  const [invitees, setInvitees] = useState<string[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const canCreate = name.trim().length > 0 && !!identity && !creating;
  const canInvite = !!identity && !creating;
  const scrollRef = useRef<HTMLFormElement>(null);
  const headerBorder = useOverflowHeaderBorder(
    scrollRef,
    `${invitees.length}:${name}:${avatarColor}:${error ?? ""}`,
  );

  useEffect(() => {
    onDraftChange?.({ name, color: avatarColor });
  }, [name, avatarColor, onDraftChange]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    try {
      await onCreate(name.trim(), avatarColor, invitees);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite(inviteeDid: string) {
    if (invitees.includes(inviteeDid)) {
      throw new Error("That participant is already on the invite list.");
    }
    setInvitees((prev) => [...prev, inviteeDid]);
  }

  return (
    <ContentPaneShell>
      <ContentPaneHeader
        title="New Group"
        onBack={onClose}
        bordered={headerBorder}
        action={
          <Button
            type="submit"
            form="new-group-form"
            variant="primary"
            isDisabled={!canCreate}
          >
            {creating ? "Creating…" : "Create"}
          </Button>
        }
      />

      <form
        id="new-group-form"
        ref={scrollRef}
        onSubmit={(e) => void onSubmit(e)}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="mt-8">
          <GroupAvatarColorPicker color={avatarColor} onChange={setAvatarColor} />
        </div>

        <div className="mt-10 px-4">
          <label className="block px-1 pb-1 type-caption text-muted">
            Group name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="type-body input-pill border-foreground placeholder:text-muted"
          />
        </div>

        <div className="mt-6 flex flex-col">
          <p className="px-5 pb-1 type-body-regular text-muted">Participants</p>
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
              <div className="mt-2">
                <ParticipantRow
                  did={identity}
                  identity={identity}
                  trailing={
                    <span className="type-body-regular text-muted">You</span>
                  }
                />
              </div>
            )}

            {invitees.map((did) => (
              <ParticipantRow
                key={did}
                did={did}
                trailing={
                  <Button
                    variant="bare"
                    isDisabled={creating}
                    onPress={() =>
                      setInvitees((prev) => prev.filter((entry) => entry !== did))
                    }
                    className="shrink-0 type-body-regular text-muted"
                    aria-label={`Remove ${did}`}
                  >
                    Remove
                  </Button>
                }
              />
            ))}
          </div>
        </div>

        {error && <p className="mt-4 px-4 type-body text-error">{error}</p>}
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
    </ContentPaneShell>
  );
}
