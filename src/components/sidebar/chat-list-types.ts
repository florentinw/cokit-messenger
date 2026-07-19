/** Presentational sidebar row — no chat/invite domain meaning. */
export type ChatListRow = {
  id: string;
  title: string;
  subtitle: string;
  /** Top-right trailing text (time, status label, …). */
  meta?: string;
  /** Unread badge count; omit when none. Also emphasizes title/meta. */
  badge?: number;
  color?: string;
};
