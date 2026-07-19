import { useState } from "react";
import { avatarForCo, truncateDid } from "../lib/messenger";
import { Icon } from "./Icon";

type Props = {
  open: boolean;
  coId: string;
  name: string;
  identity?: string;
  participants: string[];
  onClose: () => void;
  onLeave: () => Promise<void>;
};

export function GroupDetails({
  open,
  coId,
  name,
  identity,
  participants,
  onClose,
  onLeave,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!open) return null;

  async function copyInvite() {
    await navigator.clipboard.writeText(coId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/30 p-6">
      <div className="w-full max-w-sm rounded-xl bg-bg-base p-5 shadow-xl">
        <div className="flex flex-col items-center gap-2">
          <div className="size-[52px] overflow-hidden rounded-lg bg-bg-elevated p-2.5">
            <img src={avatarForCo(coId)} alt="" className="size-full" />
          </div>
          <h2 className="text-[20px] font-semibold tracking-[-0.3px] text-primary">{name}</h2>
        </div>

        <div className="mt-5">
          <p className="px-1 text-[12px] font-medium tracking-[-0.12px] text-secondary">Invite id</p>
          <div className="mt-1 flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
            <code className="min-w-0 flex-1 truncate text-[12px] text-primary">{coId}</code>
            <button
              type="button"
              onClick={() => void copyInvite()}
              aria-label="Copy invite"
              className="btn-icon text-primary"
            >
              <Icon name="copy" />
            </button>
          </div>
          {copied && <p className="mt-1 px-1 text-[12px] text-secondary">Copied</p>}
        </div>

        <div className="mt-5">
          <p className="px-1 text-[12px] font-medium tracking-[-0.12px] text-secondary">
            Participants
          </p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {(participants.length > 0 ? participants : identity ? [identity] : []).map((did) => (
              <li
                key={did}
                className="rounded-lg bg-bg-elevated px-3 py-2 text-[12px] font-medium text-primary"
              >
                {truncateDid(did, 36)}
                {did === identity ? " (you)" : ""}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-7 flex-1 rounded-full bg-bg-elevated text-[14px] font-medium text-primary"
          >
            Close
          </button>
          <button
            type="button"
            disabled={leaving}
            onClick={() => {
              setLeaving(true);
              void onLeave().finally(() => setLeaving(false));
            }}
            className="h-7 flex-1 rounded-full bg-attention text-[14px] font-medium text-white disabled:opacity-40"
          >
            {leaving ? "Leaving…" : "Leave group"}
          </button>
        </div>
      </div>
    </div>
  );
}
