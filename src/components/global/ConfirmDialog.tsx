import { Button } from "./Button";
import { AppDialog } from "./AppDialog";

type Props = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: Props) {
  return (
    <AppDialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      title={title}
      isDismissable={!busy}
    >
      {({ close }) => (
        <div className="flex flex-col gap-3 p-4">
          <p className="type-body-regular text-muted">
            {description}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              isDisabled={busy}
              className="w-full"
              onPress={() => void onConfirm()}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
            <Button
              variant="secondary"
              isDisabled={busy}
              className="w-full"
              onPress={close}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </AppDialog>
  );
}
