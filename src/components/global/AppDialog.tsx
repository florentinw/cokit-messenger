import type { ReactNode } from "react";
import {
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { Button } from "@/components/global/Button";
import { Icon } from "@/components/global/icons/Icon";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode | ((opts: { close: () => void }) => ReactNode);
  /** When false, backdrop click / Escape won't dismiss (e.g. busy confirm). */
  isDismissable?: boolean;
};

/** Accessible modal dialog shell used across the app. */
export function AppDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  isDismissable = true,
}: Props) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className="modal-overlay"
    >
      <Modal className="modal-dialog w-full max-w-[360px] outline-none">
        <Dialog className="w-full overflow-hidden layer-card rounded-lg border border-separator bg-surface outline-none">
          {({ close }) => (
            <>
              <header className="relative flex h-12 shrink-0 items-center border-b border-separator px-3.5">
                <Button
                  variant="icon"
                  onPress={close}
                  aria-label="Back"
                  className="relative z-10"
                  isDisabled={!isDismissable}
                >
                  <Icon name="back" />
                </Button>
                <Heading
                  slot="title"
                  className="type-body pointer-events-none absolute inset-x-0 text-center text-foreground"
                >
                  {title}
                </Heading>
              </header>
              {typeof children === "function" ? children({ close }) : children}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
