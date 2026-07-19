import { useSyncExternalStore } from "react";
import {
  displayName,
  getPeerNamesRevision,
  subscribePeerNames,
  truncateDid,
} from "../../lib/messenger";
import { cn } from "../../lib/utils";

type Props = {
  did: string;
  identity?: string;
  className?: string;
};

/** Display name in primary, truncated DID in secondary when a profile name exists. */
export function ParticipantLabel({ did, identity, className }: Props) {
  useSyncExternalStore(subscribePeerNames, getPeerNamesRevision, () => 0);
  const name = displayName(did, identity);
  const id = truncateDid(did, 22);
  const showName =
    !!name && name !== id && name !== did && !name.startsWith("did:");

  return (
    <span className={cn("type-body truncate text-foreground", className)}>
      {showName ? (
        <>
          {name} <span className="type-body-regular text-muted">({id})</span>
        </>
      ) : (
        id
      )}
    </span>
  );
}
