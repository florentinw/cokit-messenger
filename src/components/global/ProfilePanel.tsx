import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  readProfileName,
  truncateDid,
  writeProfileName,
} from "../../lib/messenger";
import { useOverflowHeaderBorder } from "../../lib/useOverflowHeaderBorder";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { Icon } from "./icons/Icon";

type Props = {
  identity?: string;
  onClose: () => void;
  onSaved?: (name: string) => void;
};

export function ProfilePanel({ identity, onClose, onSaved }: Props) {
  const [name, setName] = useState(readProfileName);
  const [storedName, setStoredName] = useState(readProfileName);
  const [savedFlash, setSavedFlash] = useState(false);
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== storedName;
  const scrollRef = useRef<HTMLFormElement>(null);
  const headerBorder = useOverflowHeaderBorder(scrollRef, name);

  useEffect(() => {
    const current = readProfileName();
    setName(current);
    setStoredName(current);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    writeProfileName(trimmed);
    setStoredName(trimmed);
    onSaved?.(trimmed);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
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
          <h1 className="type-body text-foreground">Profile</h1>
        </div>
        <Button
          type="submit"
          form="profile-form"
          variant="primary"
          isDisabled={!canSave}
        >
          {savedFlash ? "Saved" : "Save changes"}
        </Button>
      </header>

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
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="type-body input-pill input-pill-focus placeholder:text-muted"
          />
          <p className="mt-2 px-1 type-body-regular text-muted">
            This is how you’ll appear in chats and invites.
          </p>
        </div>
      </form>
    </section>
  );
}
