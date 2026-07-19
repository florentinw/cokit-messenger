import { useState, type FormEvent, type KeyboardEvent } from "react";
import { formatCoError } from "@/lib/co-sdk/co";
import { Button } from "../global/Button";
import { Icon } from "../global/icons/Icon";

type Props = {
  disabled?: boolean;
  placeholder?: string;
  error?: string;
  onSend: (text: string) => Promise<void> | void;
};

export function Composer({ disabled, placeholder = "Message", error, onSend }: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<{ summary: string; detail: string }>();

  async function submit() {
    const text = value.trim();
    if (!text || disabled || sending) return;
    setSending(true);
    setSendError(undefined);
    try {
      await onSend(text);
      setValue("");
    } catch (err) {
      const formatted = formatCoError(err);
      console.error("Failed to send message", err);
      setSendError({ summary: formatted.summary, detail: formatted.detail });
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  const externalError = error
    ? { summary: error, detail: error }
    : undefined;
  const displayError = sendError ?? externalError;

  async function copyErrorDetail() {
    if (!displayError) return;
    await navigator.clipboard.writeText(displayError.detail);
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <form onSubmit={onSubmit} className="flex w-full items-center">
        <div className="layer-card flex h-8 w-full items-center justify-between rounded-tl-2xl rounded-tr-2xl rounded-br-md rounded-bl-2xl border border-separator bg-surface py-1 pl-3 pr-1">
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (sendError) setSendError(undefined);
            }}
            onKeyDown={onKeyDown}
            disabled={disabled || sending}
            placeholder={placeholder}
            className="min-w-0 flex-1 type-body text-foreground placeholder:text-muted"
          />
          <Button
            type="submit"
            variant="bare"
            isDisabled={disabled || sending || !value.trim()}
            className="layer-accent interactive flex size-6 shrink-0 items-center justify-center rounded-full border-0 bg-surface p-0 text-foreground disabled:opacity-40"
            aria-label="Send message"
          >
            <Icon name="arrow-up" className="pointer-events-none size-6" />
          </Button>
        </div>
      </form>
      {displayError && (
        <div className="px-1" role="alert">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 type-caption text-error">{displayError.summary}</p>
            <Button
              variant="icon"
              onPress={() => void copyErrorDetail()}
              aria-label="Copy error details"
              className="shrink-0 text-error"
            >
              <Icon name="copy" />
            </Button>
          </div>
          {displayError.detail !== displayError.summary && (
            <details className="mt-1">
              <summary className="type-body-regular text-muted">Details</summary>
              <p className="mt-1 max-h-24 overflow-auto type-body-regular text-muted whitespace-pre-wrap break-words">
                {displayError.detail}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
