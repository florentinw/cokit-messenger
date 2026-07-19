# Messenger domain

Room / Matrix-style event model, group chat operations, profile & unread helpers.

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
