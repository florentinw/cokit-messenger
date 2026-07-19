import { useEffect, useMemo, useRef, useState } from "react";
import {
  readGroupAvatarColor,
  truncateDid,
  useChatEntry,
  type GroupAvatarColor,
} from "../../lib/messenger";
import { useOverflowHeaderBorder } from "../../lib/useOverflowHeaderBorder";
import { cn } from "../../lib/utils";
import { ActionMenu } from "../global/ActionMenu";
import { Button } from "../global/Button";
import { ConfirmDialog } from "../global/ConfirmDialog";
import { GroupAvatarColorPicker } from "../global/GroupAvatar";
import { Icon } from "../global/icons/Icon";
import { ParticipantLabel } from "../global/ParticipantLabel";
import { InviteParticipantDialog } from "./InviteParticipantDialog";

type Props = {
  coId: string;
  name: string;
  identity?: string;
  participants: string[];
  pendingInvites?: string[];
  busy?: boolean;
  onClose: () => void;
  onLeave: () => Promise<void>;
  onRemoveParticipant?: (participantDid: string) => Promise<void>;
  onInvite?: (inviteeDid: string) => Promise<void>;
  onRevokeInvite?: (inviteeDid: string) => Promise<void>;
  onSave?: (draft: { name: string; avatarColor: GroupAvatarColor }) => Promise<void>;
};

type ConfirmState =
  | { kind: "leave" }
  | { kind: "remove"; did: string }
  | { kind: "revoke"; did: string };

export function GroupDetails({
  coId,
  name,
  identity,
  participants,
  pendingInvites = [],
  busy,
  onClose,
  onLeave,
  onRemoveParticipant,
  onInvite,
  onRevokeInvite,
  onSave,
}: Props) {
  const storeEntry = useChatEntry(coId);
  const storeColor = storeEntry?.color ?? readGroupAvatarColor(coId);
  const [draftName, setDraftName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState<string>();
  const [actionBusy, setActionBusy] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [optimisticPending, setOptimisticPending] = useState<string[]>([]);
  const [hiddenPending, setHiddenPending] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>();
  const [savedColor, setSavedColor] = useState<GroupAvatarColor>(storeColor);
  const [draftColor, setDraftColor] = useState<GroupAvatarColor>(storeColor);

  const roster =
    participants.length > 0 ? participants : identity ? [identity] : [];
  const pending = useMemo(() => {
    const active = new Set(roster);
    const hidden = new Set(hiddenPending);
    const merged = [...pendingInvites, ...optimisticPending].filter(
      (did) => !active.has(did) && !hidden.has(did),
    );
    return [...new Set(merged)];
  }, [pendingInvites, optimisticPending, hiddenPending, roster]);
  const canInvite = !!onInvite && !!identity && !busy;
  const canRevoke = !!onRevokeInvite && !!identity && !busy;
  const canRemove = !!onRemoveParticipant && !!identity && !busy;
  const trimmedDraft = draftName.trim();
  const nameDirty = trimmedDraft.length > 0 && trimmedDraft !== name.trim();
  const colorDirty = draftColor !== savedColor;
  const canSave =
    !!onSave &&
    trimmedDraft.length > 0 &&
    (nameDirty || colorDirty) &&
    !busy &&
    !saving;

  const scrollRef = useRef<HTMLDivElement>(null);
  const headerBorder = useOverflowHeaderBorder(
    scrollRef,
    `${roster.length}:${pending.length}:${draftName}:${draftColor}`,
  );

  useEffect(() => {
    setDraftName(name);
    setRenameError(undefined);
    setOptimisticPending([]);
    setHiddenPending([]);
    const color = storeEntry?.color ?? readGroupAvatarColor(coId);
    setSavedColor(color);
    setDraftColor(color);
  }, [name, coId, storeEntry?.color]);

  useEffect(() => {
    // Drop optimistic rows once the group CO reports them.
    setOptimisticPending((prev) =>
      prev.filter((did) => !pendingInvites.includes(did)),
    );
    // Clear revoke hides once the CO no longer lists them as Invite.
    setHiddenPending((prev) =>
      prev.filter((did) => pendingInvites.includes(did)),
    );
  }, [pendingInvites]);

  async function onSaveChanges() {
    if (!canSave || !onSave) return;
    setSaving(true);
    setRenameError(undefined);
    try {
      await onSave({ name: trimmedDraft, avatarColor: draftColor });
      setSavedColor(draftColor);
      onClose();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite(inviteeDid: string) {
    if (!onInvite) return;
    await onInvite(inviteeDid);
    setOptimisticPending((prev) =>
      prev.includes(inviteeDid) || roster.includes(inviteeDid)
        ? prev
        : [...prev, inviteeDid],
    );
  }

  async function handleConfirm() {
    if (!confirmState || actionBusy) return;
    setActionBusy(true);
    try {
      if (confirmState.kind === "leave") {
        await onLeave();
      } else if (confirmState.kind === "revoke") {
        if (!onRevokeInvite) return;
        const did = confirmState.did;
        setHiddenPending((prev) => (prev.includes(did) ? prev : [...prev, did]));
        setOptimisticPending((prev) => prev.filter((entry) => entry !== did));
        await onRevokeInvite(did);
      } else if (onRemoveParticipant) {
        await onRemoveParticipant(confirmState.did);
      }
      setConfirmState(undefined);
    } finally {
      setActionBusy(false);
    }
  }

  function openLeaveConfirm() {
    setConfirmState({ kind: "leave" });
  }

  function openRemoveConfirm(did: string) {
    setConfirmState({ kind: "remove", did });
  }

  function openRevokeConfirm(did: string) {
    setConfirmState({ kind: "revoke", did });
  }

  return (
    <section className="content-pane layer-card relative flex h-full min-w-0 flex-1 flex-col">
      <header
        data-tauri-drag-region
        className={cn(
          "flex h-12 shrink-0 items-center justify-between bg-surface px-2.5",
          headerBorder && "border-b border-separator",
        )}
      >
        <div className="flex items-center gap-2">
          <Button variant="icon" onPress={onClose} aria-label="Back">
            <Icon name="back" />
          </Button>
          <h1 className="type-body text-foreground">Info</h1>
        </div>
        <Button
          variant="primary"
          isDisabled={!canSave}
          onPress={() => void onSaveChanges()}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </header>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mt-8">
          <GroupAvatarColorPicker color={draftColor} onChange={setDraftColor} />
        </div>

        <div className="mt-10 px-4">
          <label className="block px-1 pb-1 type-caption text-muted">
            Group name
          </label>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="type-body input-pill input-pill-focus placeholder:text-muted"
          />
          {renameError && (
            <p className="mt-1 px-1 type-body text-error">{renameError}</p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 pb-6">
          <p className="px-5 pb-1 type-body-regular text-muted">
            Participants
          </p>
          <div className="px-4">
            <Button
              variant="secondary"
              isDisabled={!canInvite}
              onPress={() => setInviteDialogOpen(true)}
              className="w-full gap-1"
              aria-label={canInvite ? "Invite by DID" : "Not available"}
            >
              <Icon name="plus" />
              Invite participant
            </Button>
          </div>

          <ul className="px-4">
            {roster.map((did) => {
              const isSelf = did === identity;
              const actions = [
                { id: "copy-did", label: "Copy DID" },
                ...(isSelf
                  ? [{ id: "leave", label: "Leave group" }]
                  : canRemove
                    ? [{ id: "remove", label: "Remove from group" }]
                    : []),
              ];

              return (
                <li
                  key={did}
                  className="flex items-center justify-between border-b border-separator py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="avatar-face flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full layer-inset bg-surface text-muted">
                      <Icon name="user" className="size-4" />
                    </div>
                    <ParticipantLabel did={did} identity={identity} />
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelf && (
                      <span className="type-body-regular text-muted">You</span>
                    )}
                    <ActionMenu
                      label="Participant options"
                      isDisabled={busy || actionBusy}
                      actions={actions}
                      onAction={(id) => {
                        if (id === "copy-did") {
                          void navigator.clipboard.writeText(did);
                        } else if (id === "leave") {
                          openLeaveConfirm();
                        } else if (id === "remove") {
                          openRemoveConfirm(did);
                        }
                      }}
                    />
                  </div>
                </li>
              );
            })}
            {pending.map((did) => (
              <li
                key={`pending-${did}`}
                className="flex items-center justify-between border-b border-separator py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="avatar-face flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full layer-inset bg-surface text-muted">
                    <Icon name="user" className="size-4" />
                  </div>
                  <ParticipantLabel did={did} identity={identity} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="type-body-regular text-muted">Invited</span>
                  <ActionMenu
                    label="Invite options"
                    isDisabled={busy || actionBusy}
                    actions={[
                      { id: "copy-did", label: "Copy DID" },
                      ...(canRevoke
                        ? [{ id: "revoke", label: "Revoke invite" }]
                        : []),
                    ]}
                    onAction={(id) => {
                      if (id === "copy-did") {
                        void navigator.clipboard.writeText(did);
                      } else if (id === "revoke") {
                        openRevokeConfirm(did);
                      }
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {onInvite && (
        <InviteParticipantDialog
          open={inviteDialogOpen}
          identity={identity}
          onClose={() => setInviteDialogOpen(false)}
          onInvite={handleInvite}
        />
      )}

      <ConfirmDialog
        open={confirmState?.kind === "leave"}
        title={`Leave “${name}” group?`}
        description={
          <>
            Are you sure you want to leave &ldquo;{name}&rdquo;? You can no longer join this group
            unless you are invited back.
          </>
        }
        confirmLabel="Leave Group"
        busy={actionBusy}
        onClose={() => setConfirmState(undefined)}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={confirmState?.kind === "remove"}
        title="Remove participant"
        description={
          confirmState?.kind === "remove" ? (
            <>
              Are you sure you want to remove &ldquo;{truncateDid(confirmState.did, 28)}&rdquo;
              from group &ldquo;{name}&rdquo;?
            </>
          ) : null
        }
        confirmLabel="Remove"
        busy={actionBusy}
        onClose={() => setConfirmState(undefined)}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={confirmState?.kind === "revoke"}
        title="Revoke invite"
        description={
          confirmState?.kind === "revoke" ? (
            <>
              Revoke the invite for &ldquo;{truncateDid(confirmState.did, 28)}&rdquo;? They
              will no longer be able to join &ldquo;{name}&rdquo; with this invite.
            </>
          ) : null
        }
        confirmLabel="Revoke invite"
        busy={actionBusy}
        onClose={() => setConfirmState(undefined)}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
