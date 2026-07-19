import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./Icon";

type Props = {
  disabled?: boolean;
  onSend: (text: string) => Promise<void> | void;
};

export function Composer({ disabled, onSend }: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const text = value.trim();
    if (!text || disabled || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setValue("");
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

  return (
    <form onSubmit={onSubmit} className="flex w-full items-center">
      <div className="flex h-8 w-full items-center justify-between rounded-tl-2xl rounded-tr-2xl rounded-br-md rounded-bl-2xl border border-border py-1 pr-2 pl-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || sending}
          placeholder="Message"
          className="min-w-0 flex-1 text-[14px] leading-[18px] tracking-[-0.14px] text-primary placeholder:text-secondary"
        />
        <button
          type="submit"
          disabled={disabled || sending || !value.trim()}
          className="flex size-7 shrink-0 items-center justify-center opacity-100 disabled:opacity-40"
          aria-label="Send message"
        >
          <Icon name="send" className="text-primary" />
        </button>
      </div>
    </form>
  );
}
