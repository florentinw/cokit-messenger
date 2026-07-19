import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  readProfileName,
  subscribeProfileName,
  truncateDid,
} from "@/lib/messenger";
import { useOverflowHeaderBorder } from "@/lib/useOverflowHeaderBorder";
import { Button } from "@/components/global/Button";
import {
  ContentPaneHeader,
  ContentPaneShell,
} from "@/components/global/ContentPaneHeader";
import { Icon } from "@/components/global/icons/Icon";

type Props = {
  identity?: string;
  onClose: () => void;
  onSave?: (name: string) => void | Promise<void>;
};

export function ProfilePanel({ identity, onClose, onSave }: Props) {
  const storedName = useSyncExternalStore(
    subscribeProfileName,
    readProfileName,
    () => "",
  );
  const [name, setName] = useState(storedName);
  const [draftDirty, setDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const trimmed = name.trim();
  const canSave = !saving && trimmed.length > 0 && trimmed !== storedName;
  const scrollRef = useRef<HTMLFormElement>(null);
  const headerBorder = useOverflowHeaderBorder(scrollRef, name);

  useEffect(() => {
    if (!draftDirty) setName(storedName);
  }, [storedName, draftDirty]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSave?.(trimmed);
      setDraftDirty(false);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ContentPaneShell>
      <ContentPaneHeader
        title="Profile"
        onBack={onClose}
        bordered={headerBorder}
        action={
          <Button
            type="submit"
            form="profile-form"
            variant="primary"
            isDisabled={!canSave}
          >
            {savedFlash ? "Saved" : saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      <form
        id="profile-form"
        ref={scrollRef}
        onSubmit={onSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8 pt-10"
      >
        <div className="mx-auto flex w-full max-w-sm flex-col items-center">
          <div className="avatar-face layer-inset flex size-24 items-center justify-center rounded-full bg-surface text-muted">
            <Icon name="user" className="size-10" />
          </div>
          <p className="mt-3 type-body text-foreground">Your profile</p>
          {identity && (
            <p className="mt-1 text-center type-body-regular text-muted" title={identity}>
              {truncateDid(identity, 36)}
            </p>
          )}
        </div>

        <div className="mt-10 w-full">
          <label className="block px-1 pb-1 type-caption text-muted">
            Display name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setDraftDirty(true);
              setName(e.target.value);
            }}
            placeholder="Your name"
            className="type-body input-pill input-pill-focus placeholder:text-muted"
          />
          <p className="mt-2 px-1 type-body-regular text-muted">
            This is how you’ll appear in chats and invites.
          </p>
        </div>
      </form>
    </ContentPaneShell>
  );
}
