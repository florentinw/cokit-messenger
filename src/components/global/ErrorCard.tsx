import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./icons/Icon";
import { RESET_LOCAL_DATA_HINT } from "../../lib/co-sdk-extras";

type Props = {
  title: string;
  message: ReactNode;
  /** Clipboard payload; defaults to title + message (+ details). */
  copyText?: string;
  hint?: ReactNode;
  details?: string;
  showReload?: boolean;
};

export function ErrorCard({
  title,
  message,
  copyText,
  hint,
  details,
  showReload = true,
}: Props) {
  const [copied, setCopied] = useState(false);
  const clipboard =
    copyText ??
    `${title}\n\n${typeof message === "string" ? message : ""}${
      details ? `\n\n${details}` : ""
    }`;

  async function copyError() {
    try {
      await navigator.clipboard.writeText(clipboard);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="layer-ground flex h-full w-full flex-col bg-surface text-foreground">
      <div data-tauri-drag-region className="h-12 shrink-0" aria-hidden="true" />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="layer-card max-w-md rounded-xl bg-surface p-6 shadow">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-semibold">{title}</h1>
            <Button
              variant="icon"
              onPress={() => void copyError()}
              aria-label={copied ? "Copied" : "Copy error"}
            >
              <Icon name={copied ? "check" : "copy"} />
            </Button>
          </div>
          <div className="mt-3 type-body-regular text-muted">{message}</div>
          {hint}
          {details && (
            <details className="mt-3">
              <summary className="type-body-regular text-muted">Technical details</summary>
              <p className="mt-2 max-h-48 overflow-auto type-body-regular text-muted whitespace-pre-wrap break-words">
                {details}
              </p>
            </details>
          )}
          {showReload && (
            <Button
              variant="bare"
              onPress={() => window.location.reload()}
              className="layer-accent interactive mt-4 flex h-7 items-center justify-center rounded-lg border-0 bg-surface px-3 type-body text-foreground"
            >
              Reload
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CorruptStorageHint() {
  return (
    <p className="mt-2 rounded-lg layer-inset bg-surface px-3 py-2 font-mono type-body-regular text-muted">
      {RESET_LOCAL_DATA_HINT}
    </p>
  );
}
