import { useState, type FormEvent } from "react";

type Props = {
  open: boolean;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onJoin: (coId: string) => Promise<void>;
};

export function JoinGroupModal({ open, busy, error, onClose, onJoin }: Props) {
  const [coId, setCoId] = useState("");

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = coId.trim();
    if (!trimmed || busy) return;
    await onJoin(trimmed);
    setCoId("");
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/30 p-6">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-sm rounded-xl bg-bg-base p-5 shadow-xl"
      >
        <h2 className="text-[20px] font-semibold tracking-[-0.3px] text-primary">Join group</h2>
        <p className="mt-1 text-[14px] leading-[18px] text-secondary">
          Paste a chat invite id to join an existing room.
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block px-1 text-[12px] font-medium tracking-[-0.12px] text-secondary">
            Invite id
          </span>
          <input
            autoFocus
            value={coId}
            onChange={(e) => setCoId(e.target.value)}
            placeholder="co id"
            className="h-8 w-full rounded-full border border-border px-4 text-[14px] font-medium tracking-[-0.14px] text-primary placeholder:text-secondary focus:border-primary focus:border-[1.5px]"
          />
        </label>
        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-600">{error}</p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-7 flex-1 rounded-full bg-bg-elevated text-[14px] font-medium text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !coId.trim()}
            className="h-7 flex-1 rounded-full bg-primary text-[14px] font-medium text-white disabled:opacity-40"
          >
            {busy ? "Joining…" : "Join"}
          </button>
        </div>
      </form>
    </div>
  );
}
