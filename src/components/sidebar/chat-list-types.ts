export type ChatListEntry = {
  coId: string;
  name: string;
  preview?: string;
  timestamp?: number;
  unread?: number;
  invited?: boolean;
  joining?: boolean;
  color?: string;
  inviterName?: string;
};
