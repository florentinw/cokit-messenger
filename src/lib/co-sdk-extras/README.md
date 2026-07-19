# `@1io/tauri-plugin-co-sdk` extras

App-level additions on top of the published packages — **not** a fork or replacement.

- [`@1io/tauri-plugin-co-sdk`](https://www.npmjs.com/package/@1io/tauri-plugin-co-sdk) — Tauri commands, events, hooks, membership/room types
- [`@1io/co-js`](https://www.npmjs.com/package/@1io/co-js) — WASM primitives (`BlockStorage`, `CoMap`, …)

What lives here (not in the npm package yet):

- Shared session cache (`getSharedCoSession`) — avoids open/close churn across panes
- Error formatting (`formatCoError`, Tauri runtime checks)
- Stale-while-revalidate React hooks (`useCoSession` with errors, `useCoCore` revision watching, …)

Prefer importing types / invoke helpers from `@1io/tauri-plugin-co-sdk` (or via this re-export) and domain logic from `src/lib/messenger/`.

**Note:** `@1io/compare` is not on the public npm registry; we vendor a minimal stub under `vendor/compare` so installs work outside the 1io intranet.
