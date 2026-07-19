import type { ComponentType, SVGProps } from "react";
import BackIcon from "../assets/icons/back.svg?react";
import BadgeIcon from "../assets/icons/badge.svg?react";
import CopyIcon from "../assets/icons/copy.svg?react";
import InfoIcon from "../assets/icons/info.svg?react";
import MoreIcon from "../assets/icons/more.svg?react";
import PlusBtnIcon from "../assets/icons/plus-btn.svg?react";
import SendIcon from "../assets/icons/send.svg?react";
import UserIcon from "../assets/icons/user.svg?react";
import UsersIcon from "../assets/icons/users.svg?react";

const icons = {
  back: BackIcon,
  badge: BadgeIcon,
  copy: CopyIcon,
  info: InfoIcon,
  more: MoreIcon,
  plus: PlusBtnIcon,
  send: SendIcon,
  user: UserIcon,
  users: UsersIcon,
} as const satisfies Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

export type IconName = keyof typeof icons;

export type IconProps = {
  name: IconName;
  className?: string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "ref" | "children" | "name">;

export function Icon({
  name,
  className = "size-6",
  title,
  ...props
}: IconProps) {
  const Svg = icons[name];
  return (
    <Svg
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...props}
    />
  );
}
