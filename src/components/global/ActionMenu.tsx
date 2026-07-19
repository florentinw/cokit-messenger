import {
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "react-aria-components";
import { cn } from "@/lib/utils";
import { Button } from "@/components/global/Button";
import { Icon } from "@/components/global/icons/Icon";

type Action = {
  id: string;
  label: string;
};

type Props = {
  label: string;
  actions: Action[];
  onAction: (id: string) => void;
  isDisabled?: boolean;
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
};

export function ActionMenu({
  label,
  actions,
  onAction,
  isDisabled,
  triggerClassName = "interactive flex size-8 items-center justify-center rounded-lg bg-transparent text-foreground disabled:opacity-40",
}: Props) {
  return (
    <MenuTrigger>
      <Button
        variant="bare"
        aria-label={label}
        isDisabled={isDisabled}
        className={triggerClassName}
      >
        <Icon name="more" />
      </Button>
      <Popover
        placement="bottom end"
        className="action-menu-popover layer-accent min-w-[200px] rounded-xl bg-surface p-1 text-foreground shadow-lg outline-none"
      >
        <Menu
          className="outline-none"
          onAction={(key) => onAction(String(key))}
        >
          {actions.map((action) => (
            <MenuItem
              key={action.id}
              id={action.id}
              className={cn(
                "flex h-8 w-full cursor-default items-center rounded-lg px-2 text-left type-body text-foreground outline-none",
                "data-[focused]:bg-white/10",
              )}
            >
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
