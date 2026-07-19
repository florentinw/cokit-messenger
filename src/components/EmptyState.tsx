import { Icon } from "./Icon";

type Props = {
  onCreate: () => void;
};

export function EmptyState({ onCreate }: Props) {
  return (
    <div className="flex h-full flex-col justify-end px-4 pb-8">
      <div className="mb-6 space-y-1 text-[14px] leading-[18px] tracking-[-0.14px] text-secondary">
        <p>Tap on + in the top right corner to start a new chat</p>
        <p>Your conversations will show up here, when you start chatting.</p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="flex h-7 w-full items-center justify-center gap-1 rounded-full bg-primary text-[14px] font-medium tracking-[-0.14px] text-white"
      >
        <Icon name="plus" className="text-white" />
        Create a group
      </button>
    </div>
  );
}
