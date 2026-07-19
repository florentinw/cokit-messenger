import { truncateDid } from "../lib/messenger";

type Props = {
  body: string;
  from: string;
  mine: boolean;
};

export function MessageBubble({ body, from, mine }: Props) {
  if (mine) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[440px] rounded-tl-2xl rounded-tr-2xl rounded-br-md rounded-bl-2xl bg-primary px-3 pb-2 pt-1.5 text-[14px] leading-[18px] tracking-[-0.21px] whitespace-pre-wrap text-white">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-start gap-0.5">
      <span className="ml-3 text-[12px] font-medium leading-4 tracking-[-0.12px] text-secondary">
        {truncateDid(from)}
      </span>
      <div className="rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-md bg-bg-elevated px-3 py-2 text-[14px] leading-[18px] tracking-[-0.21px] whitespace-pre-wrap text-primary">
        {body}
      </div>
    </div>
  );
}
