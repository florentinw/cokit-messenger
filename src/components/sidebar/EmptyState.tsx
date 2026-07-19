import { Button } from "../global/Button";
import { Icon } from "../global/icons/Icon";

type Props = {
  onCreate: () => void;
};

export function EmptyState({ onCreate }: Props) {
  return (
    <div className="flex h-full flex-col justify-end gap-6 px-4 py-5">
      <div className="flex flex-col gap-2">
        <p className="type-body text-foreground">
          Tap on + in the top right corner
          <br />
          to start an new chat
        </p>
        <p className="type-body-regular text-muted">
          Your conversations will show up here, when you start chatting.
        </p>
      </div>
      <Button
        variant="secondary"
        onPress={onCreate}
        className="w-full gap-1"
      >
        <Icon name="plus" />
        Create a group
      </Button>
    </div>
  );
}
