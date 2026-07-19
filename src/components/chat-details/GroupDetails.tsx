import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GROUP_AVATAR_COLOR,
  truncateDid,
  useChatEntry,
  type GroupAvatarColor,
} from "@/lib/messenger";
import { useOverflowHeaderBorder } from "@/lib/useOverflowHeaderBorder";
import { ActionMenu } from "@/components/global/ActionMenu";
import { Button } from "@/components/global/Button";
import { ConfirmDialog } from "@/components/global/ConfirmDialog";
import {
  ContentPaneHeader,
  ContentPaneShell,
} from "@/components/global/ContentPaneHeader";
import { GroupAvatarColorPicker } from "@/components/global/GroupAvatar";
import { Icon } from "@/components/global/icons/Icon";
import { CoMemberRow } from "@/components/global/CoMemberRow";
import { InviteCoMemberDialog } from "@/components/chat-details/InviteCoMemberDialog";

type Props = {
  coId: string;
  identity?: string;
  members: string[];
  pendingInvites?: string[];
  onClose: () => void;
  onLeave: () => Promise<void>;
  onRemoveCoMember?: (memberDid: string) => Promise<void>;
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
  identity,
  members,
  pendingInvites = [],
  onClose,
  onLeave,
  onRemoveCoMember,
  onInvite,
  onRevokeInvite,
  onSave,
}: Props) {
  const storeEntry = useChatEntry(coId);
  const name = storeEntry?.name || "Group chat";
  const storeColor = storeEntry?.color ?? DEFAULT_GROUP_AVATAR_COLOR;
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
    members.length > 0 ? members : identity ? [identity] : [];
  const pending = useMemo(() => {
    const active = new Set(roster);
    const hidden = new Set(hiddenPending);
    const merged = [...pendingInvites, ...optimisticPending].filter(
      (did) => !active.has(did) && !hidden.has(did),
    );
    return [...new Set(merged)];
  }, [pendingInvites, optimisticPending, hiddenPending, roster]);
  const canInvite = !!onInvite && !!identity && !actionBusy;
  const canRevoke = !!onRevokeInvite && !!identity && !actionBusy;
  const canRemove = !!onRemoveCoMember && !!identity && !actionBusy;
  const trimmedDraft = draftName.trim();
  const nameDirty = trimmedDraft.length > 0 && trimmedDraft !== name.trim();
  const colorDirty = draftColor !== savedColor;
  const canSave =
    !!onSave &&
    trimmedDraft.length > 0 &&
    (nameDirty || colorDirty) &&
    !saving &&
    !actionBusy;

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
    const color = storeEntry?.color ?? DEFAULT_GROUP_AVATAR_COLOR;
    setSavedColor(color);
    setDraftColor(color);
  }, [name, coId, storeEntry?.color]);

  useEffect(() => {
    setOptimisticPending((prev) =>
      prev.filter((did) => !pendingInvites.includes(did)),
    );
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
      } else if (onRemoveCoMember) {
        await onRemoveCoMember(confirmState.did);
      }
      setConfirmState(undefined);
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <ContentPaneShell>
      <ContentPaneHeader
        title="Info"
        onBack={onClose}
        bordered={headerBorder}
        dragHeader
        action={
          <Button
            variant="primary"
            isDisabled={!canSave}
            onPress={() => void onSaveChanges()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />

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
          <p className="px-5 pb-1 type-body-regular text-muted">Members</p>
          <div className="px-4">
            <Button
              variant="secondary"
              isDisabled={!canInvite}
              onPress={() => setInviteDialogOpen(true)}
              className="w-full gap-1"
              aria-label={canInvite ? "Invite by DID" : "Not available"}
            >
              <Icon name="plus" />
              Invite member
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
                <li key={did}>
                  <CoMemberRow
                    did={did}
                    identity={identity}
                    trailing={
                      <div className="flex items-center gap-2">
                        {isSelf && (
                          <span className="type-body-regular text-muted">You</span>
                        )}
                        <ActionMenu
                          label="Member options"
                          isDisabled={actionBusy}
                          actions={actions}
                          onAction={(id) => {
                            if (id === "copy-did") {
                              void navigator.clipboard.writeText(did);
                            } else if (id === "leave") {
                              setConfirmState({ kind: "leave" });
                            } else if (id === "remove") {
                              setConfirmState({ kind: "remove", did });
                            }
                          }}
                        />
                      </div>
                    }
                  />
                </li>
              );
            })}
            {pending.map((did) => (
              <li key={`pending-${did}`}>
                <CoMemberRow
                  did={did}
                  identity={identity}
                  trailing={
                    <div className="flex items-center gap-2">
                      <span className="type-body-regular text-muted">Invited</span>
                      <ActionMenu
                        label="Invite options"
                        isDisabled={actionBusy}
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
                            setConfirmState({ kind: "revoke", did });
                          }
                        }}
                      />
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {onInvite && (
        <InviteCoMemberDialog
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
        title="Remove member"
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
    </ContentPaneShell>
  );
}
