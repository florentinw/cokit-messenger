import { useEffect, useState, type FormEvent } from "react";
import { truncateDid } from "../lib/messenger";
import { Icon } from "./Icon";

type Props = {
  identity?: string;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
};

export function NewGroupPanel({
  identity,
  busy,
  error,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState("");
  const canCreate = name.trim().length > 0 && !!identity && !busy;

  useEffect(() => {
    setName("");
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    await onCreate(name.trim());
  }

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col bg-bg-base">
      <header
        data-tauri-drag-region
        className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3.5"
      >
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Back" className="btn-icon">
            <Icon name="back" className="text-primary" />
          </button>
          <h1 className="text-[14px] font-medium tracking-[-0.14px] text-primary">
            New Group
          </h1>
        </div>
        <button
          type="submit"
          form="new-group-form"
          disabled={!canCreate}
          className="flex h-7 items-center justify-center rounded-full bg-primary px-3 text-[14px] font-medium tracking-[-0.14px] text-white disabled:opacity-20"
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </header>

      <form
        id="new-group-form"
        onSubmit={(e) => void onSubmit(e)}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex size-24 items-center justify-center rounded-[15px] bg-bg-elevated text-secondary">
            <Icon name="users" />
          </div>
          <p className="text-[14px] font-medium tracking-[-0.14px] text-primary">
            Choose an image
          </p>
        </div>

        <div className="mt-10 px-4">
          <label className="block px-1 pb-1 text-[12px] font-medium tracking-[-0.12px] text-secondary">
            Group name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Birthday"
            className="h-8 w-full rounded-full border-[1.5px] border-primary px-4 text-[14px] font-medium tracking-[-0.14px] text-primary placeholder:text-secondary"
          />
        </div>

        <div className="mt-6 flex flex-col">
          <p className="px-5 pb-1 text-[12px] font-medium tracking-[-0.12px] text-secondary">
            Participants
          </p>
          <div className="px-4">
            <button
              type="button"
              disabled
              className="flex h-7 w-full items-center justify-center gap-1 rounded-full bg-bg-elevated text-[14px] font-medium tracking-[-0.14px] text-primary opacity-50"
              title="Coming soon"
            >
              <Icon name="plus" />
              Invite participant
            </button>
          </div>

          {identity && (
            <div className="mt-2 flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center overflow-hidden rounded-full border-[0.5px] border-border bg-bg-elevated text-secondary">
                  <Icon name="user" />
                </div>
                <span className="text-[14px] font-medium tracking-[-0.14px] text-primary">
                  {truncateDid(identity, 28)}
                </span>
              </div>
              <span className="text-[14px] tracking-[-0.21px] text-secondary">You</span>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 px-4 text-[13px] text-attention">{error}</p>
        )}
        {!identity && (
          <p className="mt-4 px-4 text-[13px] text-secondary">
            Creating your local ID (did:key) so you can join chats — Create unlocks
            when it’s ready.
          </p>
        )}
      </form>
    </section>
  );
}
