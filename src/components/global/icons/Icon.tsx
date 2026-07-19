import type { ComponentType, SVGProps } from "react";
import ArrowUpIcon from "./svgs/arrow-up.svg?react";
import BackIcon from "./svgs/back.svg?react";
import CheckIcon from "./svgs/check.svg?react";
import CopyIcon from "./svgs/copy.svg?react";
import InfoIcon from "./svgs/info.svg?react";
import MoreIcon from "./svgs/more.svg?react";
import PlusBtnIcon from "./svgs/plus-btn.svg?react";
import SettingsIcon from "./svgs/settings.svg?react";
import UserIcon from "./svgs/user.svg?react";
import UsersIcon from "./svgs/users.svg?react";

const icons = {
  "arrow-up": ArrowUpIcon,
  back: BackIcon,
  check: CheckIcon,
  copy: CopyIcon,
  info: InfoIcon,
  more: MoreIcon,
  plus: PlusBtnIcon,
  settings: SettingsIcon,
  user: UserIcon,
  users: UsersIcon,
} as const satisfies Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

export type IconName = keyof typeof icons;

export type IconProps = {
  name: IconName;
  className?: string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "ref" | "children" | "name">;

function iconClassName(className?: string) {
  const hasExplicitSize =
    className != null &&
    /\bsize-(?:\d+|\[[^\]]+\])|\bw-(?:\d+|\[[^\]]+\])|\bh-(?:\d+|\[[^\]]+\])/.test(
      className,
    );

  return [hasExplicitSize ? null : "size-6", "block shrink-0", className]
    .filter(Boolean)
    .join(" ");
}

export function Icon({
  name,
  className,
  title,
  ...props
}: IconProps) {
  const Svg = icons[name];
  return (
    <Svg
      className={iconClassName(className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...props}
    />
  );
}
