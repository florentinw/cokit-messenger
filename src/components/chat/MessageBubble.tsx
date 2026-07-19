import { useSyncExternalStore } from "react";
import {
  displayName,
  getPeerNamesRevision,
  subscribePeerNames,
} from "@/lib/messenger";
import { cn } from "@/lib/utils";

export type MessageCluster = "standalone" | "first" | "middle" | "last";

type Props = {
  body: string;
  from: string;
  mine: boolean;
  identity?: string;
  cluster?: MessageCluster;
};

function mineRadius(cluster: MessageCluster): string {
  switch (cluster) {
    case "first":
      return "rounded-tl-2xl rounded-tr-2xl rounded-br-sm rounded-bl-2xl";
    case "middle":
      return "rounded-tl-2xl rounded-tr-sm rounded-br-sm rounded-bl-2xl";
    case "last":
      return "rounded-tl-2xl rounded-tr-sm rounded-br-md rounded-bl-2xl";
    default:
      return "rounded-tl-2xl rounded-tr-2xl rounded-br-md rounded-bl-2xl";
  }
}

function otherRadius(cluster: MessageCluster): string {
  switch (cluster) {
    case "first":
      return "rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-sm";
    case "middle":
      return "rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-sm";
    case "last":
      return "rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-md";
    default:
      return "rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-md";
  }
}

export function MessageBubble({
  body,
  from,
  mine,
  identity,
  cluster = "standalone",
}: Props) {
  useSyncExternalStore(subscribePeerNames, getPeerNamesRevision, () => 0);
  const showSender = !mine && (cluster === "standalone" || cluster === "first");

  if (mine) {
    return (
      <div className="flex w-full justify-end">
        <div
          className={cn(
            "message-bubble layer-accent max-w-[440px] bg-surface px-3 pb-2 pt-1.5 type-body whitespace-pre-wrap text-foreground",
            mineRadius(cluster),
          )}
        >
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-start">
      {showSender && (
        <span className="mb-0.5 ml-3 type-caption text-muted">
          {displayName(from, identity)}
        </span>
      )}
      <div
        className={cn(
          "message-bubble layer-inset bg-surface px-3 py-2 type-body whitespace-pre-wrap text-foreground",
          otherRadius(cluster),
        )}
      >
        {body}
      </div>
    </div>
  );
}
