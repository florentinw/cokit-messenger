import {
  DEFAULT_GROUP_AVATAR_COLOR,
  defaultGroupAvatarColor,
  GROUP_AVATAR_COLORS,
  GROUP_AVATAR_SRC,
  useChatEntry,
  type GroupAvatarColor,
} from "@/lib/messenger";
import { AppDialog } from "@/components/global/AppDialog";
import { Button } from "@/components/global/Button";
import { useState } from "react";

type Props = {
  coId?: string;
  /** Explicit color (create / draft picker). Wins over ChatStore. */
  color?: string;
  className?: string;
  /** Extra classes on the group-avatar image wrapper (padding). */
  padClassName?: string;
};

/**
 * Display color: prop → ChatStore → deterministic default.
 * CO tags are written into ChatStore by `refreshChatFromCo` / hydrate — not here.
 */
export function GroupAvatar({
  coId,
  color,
  className = "size-12",
  padClassName = "p-[18%]",
}: Props) {
  const entry = useChatEntry(color ? undefined : coId);
  const background =
    color ??
    entry?.color ??
    (coId ? defaultGroupAvatarColor(coId) : DEFAULT_GROUP_AVATAR_COLOR);

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
