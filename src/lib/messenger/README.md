# Messenger domain

Room / Matrix-style event model, group chat operations, profile & unread helpers.

## Upstream patches

COKIT diffs we rely on until they’re merged upstream live in [`patches/`](./patches/).

- `cokit-invite-persist-display-tags.patch` — keep invite CO tags (name, avatar color, …) on the invitee’s membership so the accept UI can render before `sessionOpen`.
