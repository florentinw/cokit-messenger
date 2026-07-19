import type { ReactNode } from "react";
import { Icon } from "./icons/Icon";
import { ParticipantLabel } from "./ParticipantLabel";

type Props = {
  did: string;
  identity?: string;
  trailing?: ReactNode;
};

export function ParticipantRow({ did, identity, trailing }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-separator py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="avatar-face flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full layer-inset bg-surface text-muted">
          <Icon name="user" className="size-4" />
        </div>
        <ParticipantLabel did={did} identity={identity} />
      </div>
      {trailing}
    </div>
  );
}
