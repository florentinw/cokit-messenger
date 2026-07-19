# Messenger domain

Room / Matrix-style event model, group chat operations, profile & unread helpers.

## Identity vs CoMembers

- **LocalMembership** — my relationship to a CO (sidebar chats / invites). Helpers: `collectLocalMemberships`, `localMembershipStateFor`, `joinLocalMembership`, …
- **CoMembers** — people on that CO (roster). Helpers: `collectCoMembers`, `inviteCoMember`, `removeCoMember`. COKIT wire actions still use `Participant*` discriminants.
- Cores (`ROOM_CORE`, `LOCAL_MEMBERSHIP_CORE`, `CO_CORE`) are named reducers inside a CO; see `@/lib/co-sdk/core` for `pushAction` / `useCore`.

## Data schema

This app does **not** define a custom WASM core like the [cokit README Todo example](https://github.com/1iolabs/cokit).
It uses the built-in **co-messaging** cores that ship with `tauri-plugin-co-sdk`:

| Core | Constant | Role |
|------|----------|------|
| `membership` | `LOCAL_MEMBERSHIP_CORE` | Local list of chats / invites (LocalMembership) |
| `room` | `ROOM_CORE` | Group metadata + message timeline |
| `co` | `CO_CORE` | Container core (tags + CoMember wire actions) |

Same pattern as the [example todo app](https://github.com/1iolabs/example-cokit-todo-list) (core state + push actions), except messaging cores already exist. A custom `#[co]` crate is only needed for new domain types (e.g. Todo).

`LocalMembership*` types come from `@1io/tauri-plugin-co-sdk` (via `@/lib/co-sdk/identity`); room UI state is typed against the published `Room` schema (via `@/lib/co-sdk/co`).

## Modules

| File | Role |
|------|------|
| `chat-store.ts` | Single writer for sidebar + transcript meta (name, color, preview, actions) |
| `tags.ts` | CO tag read/write (name, color, display names, invite meta) |
| `group-ops.ts` | Create / join / invite / leave / send |
| `membership.ts` | LocalMembership list + CoMembers roster |
| `timeline.ts` | Action → chat timeline |
| `format.ts` | Display helpers (`displayName`, times) |
| `group-avatar.ts` | Avatar color palette (UI reads color from ChatStore) |
| `types.ts` | Domain constants, room types, app runtime copy |
