# `@1io/tauri-plugin-co-sdk` extras

App-level additions on top of the published packages. We use this as the single
source of truth for the repo to track what’s missing in the COKIT SDK.

**CO** = collaboration object (open-ended container for any cores/content).

## Layers

```text
Identity          → who I am + LocalMembership (my status for a CO)
CO                → container + session / tip / events / resolve / push / actions
CoMembers         → people on a CO (messenger helpers; COKIT wire still uses Participant* actions)
```

- App / messenger / component code must import from `src/lib/co-sdk-extras` —
  **not** from `@1io/tauri-plugin-co-sdk` directly.
- Only modules under this folder may import `@1io/tauri-plugin-co-sdk`.
- Messenger domain (rooms, timeline, chat-store) stays in `src/lib/messenger/`.

### Folders

| Path | Role |
|------|------|
| `identity/` | `createIdentity`, `useIdentity`, `LocalMembership*` aliases, `KeystoreKey` |
| `co/` | session cache, tip hooks (`useCoTip` / `useCoreTip`), data hooks (`useCo` / `useCore`), invoke, `DagList` |
| `errors/` | `formatCoError`, `CoErrorType` |

### Upstream gap candidates

- Shared session cache (`getSharedCoSession`)
- Error formatting with `type` (`formatCoError`)
- SWR hooks: tip (`useCoTip`, `useCoreTip`) vs decoded data (`useCo`, `useCore`); also `useCoSession`, `useIdentity`
- Clearer names vs SDK (`LocalMembership` vs `Membership`)

The public surface is the explicit named exports in `index.ts`. Every exported
function documents `@param` / `@returns` on the defining module.

**Note:** `@1io/compare` is not on the public npm registry; we vendor a minimal stub under `vendor/compare` so installs work outside the 1io intranet.
