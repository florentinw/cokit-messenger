import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CID } from "multiformats";
import {
  avatarColorFromCoTags,
  chatStore,
  getGroupAvatarColorRevision,
  GROUP_AVATAR_COLORS,
  GROUP_AVATAR_SRC,
  readGroupAvatarColor,
  subscribeGroupAvatarColors,
  useChatEntry,
  type GroupAvatarColor,
} from "../../lib/messenger";
import { useCo, useCoSession, resolveCid } from "../../lib/co-sdk";
import { AppDialog } from "./AppDialog";
import { Button } from "./Button";

type Props = {
  coId?: string;
  /** Explicit color (create / draft picker / store). Wins over resolved CO tag. */
  color?: string;
  /**
   * When false, skip opening the group CO (e.g. pending invites cannot sessionOpen).
   * Color comes from ChatStore / local cache written during invite hydrate.
   */
  syncFromCo?: boolean;
  className?: string;
  /** Extra classes on the butterfly image wrapper (padding). */
  padClassName?: string;
};

function headsKey(heads: CID[] | undefined): string {
  return heads?.map((h) => h.toString()).join("\0") ?? "";
}

/**
 * Optionally pull avatar color from CO tags into ChatStore (stale-guarded).
 * Display prefers store / props — this only feeds the store.
 */
function useSyncAvatarColorIntoStore(
  coId: string | undefined,
  syncFromCo: boolean,
): void {
  const enabled = !!coId && syncFromCo;
  const { sessionId } = useCoSession(enabled ? coId! : "local");
  const [stateCid, heads] = useCo(enabled ? coId! : "local");
  const loadGen = useRef(0);

  useEffect(() => {
    if (!enabled || !coId || !sessionId || stateCid === undefined) return;
    const gen = ++loadGen.current;
    const capturedLocalRevision = chatStore.get(coId)?.localRevision ?? 0;
    let cancelled = false;

    async function load() {
      try {
        if (!stateCid) return;
        const co = (await resolveCid(sessionId!, stateCid)) as { t?: unknown };
        if (cancelled || gen !== loadGen.current) return;
        const fromTags = avatarColorFromCoTags(co.t);
        if (fromTags) {
          chatStore.applyRemote(coId!, { color: fromTags }, capturedLocalRevision);
        }
      } catch {
        // keep store / cache as-is
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, coId, sessionId, stateCid, headsKey(heads)]);
}

export function GroupAvatar({
  coId,
  color,
  syncFromCo = true,
  className = "size-12",
  padClassName = "p-[18%]",
}: Props) {
  const revision = useSyncExternalStore(
    subscribeGroupAvatarColors,
    getGroupAvatarColorRevision,
    () => 0,
  );
  const entry = useChatEntry(color ? undefined : coId);
  useSyncAvatarColorIntoStore(color ? undefined : coId, syncFromCo);

  // Prefer explicit prop → ChatStore → localStorage cache → default.
  const [cached, setCached] = useState<GroupAvatarColor | undefined>(() =>
    coId ? readGroupAvatarColor(coId) : undefined,
  );
  useEffect(() => {
    if (!coId) {
      setCached(undefined);
      return;
    }
    setCached(readGroupAvatarColor(coId));
  }, [coId, revision, entry?.color]);

  const background =
    color ?? entry?.color ?? cached ?? GROUP_AVATAR_COLORS[0];

  return (
    <div
      className={`avatar-tile shrink-0 overflow-hidden ${className}`}
      style={{ background }}
    >
      <div className={`box-border flex size-full items-center justify-center ${padClassName}`}>
        <img
          src={GROUP_AVATAR_SRC}
          alt=""
          className="size-full object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
          draggable={false}
        />
      </div>
    </div>
  );
}

type PickerProps = {
  color: GroupAvatarColor;
  onChange: (color: GroupAvatarColor) => void;
  /** Avatar tile size classes, e.g. size-24 */
  avatarClassName?: string;
};

export function GroupAvatarColorPicker({
  color,
  onChange,
  avatarClassName = "size-24",
}: PickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <Button
          variant="bare"
          aria-label="Choose group color"
          className={`${avatarClassName} cursor-pointer rounded-[15px] border-0 bg-transparent p-0`}
          onPress={() => setOpen(true)}
        >
          <GroupAvatar color={color} className="size-full rounded-[15px]" padClassName="p-[22%]" />
        </Button>
      </div>

      <AppDialog
        isOpen={open}
        onOpenChange={setOpen}
        title="Pick a color"
      >
        {({ close }) => (
          <div className="flex flex-col items-center gap-5 p-5">
            <GroupAvatar
              color={color}
              className="size-20 rounded-[15px]"
              padClassName="p-[22%]"
            />
            <div className="flex max-w-[220px] flex-wrap justify-center gap-2">
              {GROUP_AVATAR_COLORS.map((swatch) => {
                const selected = swatch === color;
                return (
                  <Button
                    key={swatch}
                    variant="bare"
                    aria-label={`Color ${swatch}`}
                    aria-pressed={selected}
                    onPress={() => {
                      onChange(swatch);
                      close();
                    }}
                    className={`size-7 shrink-0 rounded-full border-2 p-0 ${
                      selected ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ background: swatch }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </AppDialog>
    </>
  );
}
