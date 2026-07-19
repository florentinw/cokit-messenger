export type Pane =
  | { kind: "empty" }
  | { kind: "chat"; id: string }
  | { kind: "details"; id: string }
  | { kind: "create" }
  | { kind: "profile" };

export function paneChatId(pane: Pane): string | undefined {
  return pane.kind === "chat" || pane.kind === "details" ? pane.id : undefined;
}
