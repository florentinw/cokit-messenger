# `@1io/tauri-plugin-co-sdk` extras

App-level additions on top of the published packages. We use this as the single
source of truth for the repo to track what’s missing in the COKIT SDK.

- App / messenger / component code must import CO SDK symbols from
  `src/lib/co-sdk-extras` — **not** from `@1io/tauri-plugin-co-sdk` directly.
- Only modules under this folder may import `@1io/tauri-plugin-co-sdk`.
- Messenger domain logic (rooms, tags, timeline, group ops) stays in
  `src/lib/messenger/`.

Packages wrapped here:

- [`@1io/tauri-plugin-co-sdk`](https://www.npmjs.com/package/@1io/tauri-plugin-co-sdk) — Tauri commands, events, membership/room types
- [`@1io/co-js`](https://www.npmjs.com/package/@1io/co-js) — WASM primitives (`BlockStorage`, `CoMap`, …); import via extras when needed

What this folder adds on top of the npm package (candidates to upstream):

- Shared session cache (`getSharedCoSession`) — avoids open/close churn across panes
- Error formatting (`formatCoError` with `type`, Tauri runtime checks)
- Stale-while-revalidate React hooks (`useCoSession` with errors, `useCoreTipCid` refresh via heads, …)
- Thin wrappers (`listenCoSdkState`, invoke guards with one-time Tauri assert)

The public surface is the explicit named exports in `index.ts`. Every exported
function documents its parameters (`@param`) and return value (`@returns`) in
JSDoc on the defining module.

**Note:** `@1io/compare` is not on the public npm registry; we vendor a minimal stub under `vendor/compare` so installs work outside the 1io intranet.
