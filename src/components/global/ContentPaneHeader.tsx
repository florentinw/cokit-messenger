import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { Icon } from "./icons/Icon";

type Props = {
  title: string;
  onBack: () => void;
  action?: ReactNode;
  bordered?: boolean;
  /** Drag region on the whole header (vs. title strip only). */
  dragHeader?: boolean;
  className?: string;
};

export function ContentPaneHeader({
  title,
  onBack,
  action,
  bordered,
  dragHeader,
  className,
}: Props) {
  const back = (
    <Button variant="icon" onPress={onBack} aria-label="Back">
      <Icon name="back" />
    </Button>
  );
  const titleEl = <h1 className="type-body text-foreground">{title}</h1>;

  return (
    <header
      {...(dragHeader ? { "data-tauri-drag-region": true } : {})}
      className={cn(
        "flex h-12 shrink-0 items-center bg-surface px-2.5",
        dragHeader ? "justify-between" : "gap-2",
        bordered && "border-b border-separator",
        className,
      )}
    >
      {dragHeader ? (
        <div className="flex items-center gap-2">
          {back}
          {titleEl}
        </div>
      ) : (
        <>
          {back}
          <div
            data-tauri-drag-region
            className="flex min-w-0 flex-1 items-center self-stretch"
          >
            {titleEl}
          </div>
        </>
      )}
      {action}
    </header>
  );
}

type ShellProps = {
  children: ReactNode;
  className?: string;
};

export function ContentPaneShell({ children, className }: ShellProps) {
  return (
    <section
      className={cn(
        "content-pane layer-card relative flex h-full min-w-0 flex-1 flex-col",
        className,
      )}
    >
      {children}
    </section>
  );
}
