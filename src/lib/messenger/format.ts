import { readProfileName } from "@/lib/messenger/profile";
import { getPeerName } from "@/lib/messenger/peer-names";

export function truncateDid(did: string, max = 22): string {
  if (did.length <= max) return did;
  return `${did.slice(0, max - 1)}…`;
}

export function formatChatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function dateChipLabel(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (startOfMsg === startOfToday) return "Today";
  if (startOfMsg === startOfToday - 86_400_000) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function displayName(did: string, selfDid?: string): string {
  if (selfDid && did === selfDid) {
    const profile = readProfileName();
    if (profile) return profile;
  }
  const peer = getPeerName(did);
  if (peer) return peer;
  return truncateDid(did);
}

