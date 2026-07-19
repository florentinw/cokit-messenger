import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "secondary" | "icon" | "danger" | "bare";

type Props = Omit<AriaButtonProps, "className"> & {
  variant?: ButtonVariant;
  className?: string;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-pill layer-accent bg-surface interactive text-foreground disabled:opacity-40",
  secondary: "btn-pill layer-inset bg-surface interactive text-foreground disabled:opacity-40",
  icon: "btn-icon text-foreground disabled:opacity-40",
  danger: "btn-pill bg-error text-white disabled:opacity-40",
  bare: "",
};

export function Button({
  variant = "primary",
  className,
  ...rest
}: Props) {
  return (
    <AriaButton
      {...rest}
      className={cn(variantClass[variant], className)}
    />
  );
}
