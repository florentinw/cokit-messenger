import { useEffect, useState, type FormEvent } from "react";
import { Input, Label, TextField } from "react-aria-components";
import { AppDialog } from "../global/AppDialog";
import { Button } from "../global/Button";

type Props = {
  open: boolean;
  identity?: string;
  onClose: () => void;
  onInvite: (inviteeDid: string) => Promise<void>;
};

export function InviteCoMemberDialog({
  open,
  identity,
  onClose,
  onInvite,
}: Props) {
  const [deviceId, setDeviceId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) {
      setDeviceId("");
      setError(undefined);
      setInviting(false);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = deviceId.trim();
    if (!trimmed || inviting) return;
    if (trimmed === identity) {
      setError("You cannot invite yourself.");
      return;
    }
    setInviting(true);
    setError(undefined);
    try {
      await onInvite(trimmed);
      setDeviceId("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInviting(false);
    }
  }

  return (
    <AppDialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next && !inviting) onClose();
      }}
      title="Invite member"
      isDismissable={!inviting}
    >
      <form onSubmit={(e) => void onSubmit(e)} className="p-4">
        <TextField
          value={deviceId}
          onChange={setDeviceId}
          isDisabled={inviting}
          className="flex flex-col"
        >
          <Label className="block px-1 pb-1 type-caption text-muted">
            Device ID
          </Label>
          <Input
            autoFocus
            placeholder="did:key:…"
            className="type-body input-pill input-pill-focus placeholder:text-muted"
          />
        </TextField>
        {error && (
          <p className="mt-3 type-body text-error">{error}</p>
        )}
        <Button
          type="submit"
          variant="primary"
          isDisabled={inviting || !deviceId.trim()}
          className="mt-4 w-full"
        >
          {inviting ? "Adding…" : "Add to group"}
        </Button>
      </form>
    </AppDialog>
  );
}
