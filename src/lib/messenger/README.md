# Messenger domain

Room / Matrix-style event model, group chat operations, profile & unread helpers.

## Data schema

This app does **not** define a custom WASM core like the [cokit README Todo example](https://github.com/1iolabs/cokit).
It uses the built-in **co-messaging** cores that ship with `tauri-plugin-co-sdk`:

| Core | Role |
|------|------|
| `membership` | Local list of chats / invites |
| `room` | Group metadata + message timeline |

Same pattern as the [example todo app](https://github.com/1iolabs/example-cokit-todo-list) (core state + push actions), except messaging cores already exist. A custom `#[co]` crate is only needed for new domain types (e.g. Todo).

Membership types come from `@1io/tauri-plugin-co-sdk`; room UI state is typed against the published `Room` schema.

## Modules

| File | Role |
|------|------|
| `chat-store.ts` | Single writer for sidebar + transcript meta (name, color, preview, actions) |
| `tags.ts` | CO tag read/write (name, color, display names, invite meta) |
| `group-ops.ts` | Create / join / invite / leave / send |
| `membership.ts` | Local membership list + group participant roster |
| `timeline.ts` | Action → chat timeline |
| `format.ts` | Display helpers (`displayName`, times) |
| `group-avatar.ts` | Avatar color palette (UI reads color from ChatStore) |
