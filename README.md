# CO Messenger (Tauri + React)

Desktop messenger built with Tauri 2, React, and the CO SDK plugin.

## Quick start (two instances)

```bash
pnpm install
pnpm tauri:dev
```

This starts **two app windows** with different identities:

1. **Instance A** — starts Vite on **http://localhost:1420** and opens `CO Messenger`
2. **Instance B** — waits for Vite, then opens `CO Messenger (B)` reusing the same dev server

Data dirs: `tmp/data` (A) and `tmp/data-b` (B). Network is on so they can resolve groups and message each other.

Environment set by the scripts:

| Variable | Value | Purpose |
|----------|-------|---------|
| `CO_BASE_PATH` | `$PWD/tmp/data` or `tmp/data-b` | Separate keystore / CO state per instance |
| `CO_NO_KEYCHAIN` | `true` | Store keys on disk instead of macOS Keychain (required for parallel dev instances) |
| `CO_ENABLE_NETWORK` | `true` | Required for cross-instance group joins |

For a **single offline instance** (no network, one window): `pnpm tauri:dev:single`.

## Two instances with different DIDs

Use this to test creating a group as one user and joining from another.

Each instance gets its own `CO_BASE_PATH` → separate on-disk keystore → **different `did:key` identities**.

Both instances need **`CO_ENABLE_NETWORK=true`** so instance B can resolve the group CO id created in A.

### Default: `pnpm tauri:dev`

Starts instance **A**, waits until **http://localhost:1420** responds, then starts **B**. Ctrl+C stops both.

### Manual start (separate terminals)

Use this if you only want B/C without restarting A, or when debugging one instance.

**Pattern:** instance **A** starts Vite + the first Tauri shell. Instances **B** (and **C**) reuse the existing Vite dev server and only launch another Tauri process with a different `CO_BASE_PATH`.

**Terminal 1 — instance A** (starts Vite + first window):

```bash
pnpm tauri:dev:a
```

**Terminal 2 — instance B** (second window, reuses Vite on 1420):

```bash
pnpm tauri:dev:b
```

Optional **third instance**:

```bash
pnpm tauri:dev:c
```

Window titles: `CO Messenger` (A), `CO Messenger (B)`, `CO Messenger (C)`.

### Test flow: create group in A, join from B

1. Start both instances (`pnpm tauri:dev`, or **A** then **B** manually). Wait for **Your ID** in each sidebar footer — they must differ.
2. In **A**: **+** → create a group (e.g. “Test room”).
3. In **A**: open the chat → **Info** (header) → copy **Invite id** (group CO id).
4. In **B**: click the **Join group** icon in the sidebar header → paste the invite id → **Join**.
5. Send messages from both windows; each side shows a different DID.

You can also copy **Your ID** from the sidebar footer to confirm the two instances are distinct identities.

### Script reference

| Script | Description |
|--------|-------------|
| `pnpm tauri:dev` | **Default.** Two networked windows (A + B) |
| `pnpm tauri:dev:single` | Single offline window (`tmp/data`, no network) |
| `pnpm dev` | Vite on port 1420 (started by Tauri instance A) |
| `pnpm build` | Typecheck + production frontend build |
| `pnpm preview` | Preview production build |
| `pnpm tauri` | Tauri CLI passthrough (e.g. `pnpm tauri build`) |
| `pnpm icons:macos` | Pad Icon Composer 1024 export → regenerate Dock/app icons |
| `pnpm clear:data` | Wipe `tmp/data*` CO stores (new identities on next launch) |

**Advanced — manual instances** (start A before B/C; used by `tauri:dev` for A and B):

| Script | Data dir | Starts Vite? |
|--------|----------|--------------|
| `pnpm tauri:dev:a` | `tmp/data` | yes |
| `pnpm tauri:dev:b` | `tmp/data-b` | no (reuses 1420) |
| `pnpm tauri:dev:c` | `tmp/data-c` | no (reuses 1420) |

Implementation notes:

- **A** uses the default `tauri.conf.json` (`beforeDevCommand: pnpm dev`).
- **B** / **C** merge `src-tauri/tauri.dev-instance-*.conf.json`, which sets `beforeDevCommand` to `""` and passes `--no-dev-server-wait` so Tauri attaches to http://localhost:1420 without spawning another Vite process.
- **`pnpm tauri:dev`** starts A, waits for Vite, then starts B (inline shell in `package.json`).
- Rust reads `CO_BASE_PATH` in `src-tauri/src/lib.rs` and passes it to `CoApplicationSettings::with_path`.

### Resetting test data

```bash
pnpm clear:data
```

Stops using the on-disk CO stores under `tmp/data`, `tmp/data-b`, and `tmp/data-c`. Next launch recreates empty stores and new identities.

If send fails with **Resolve Identity** / **Block not found** under `tmp/data/log/co.log`, local CO storage is inconsistent (often after switching between `pnpm tauri:dev:single` and networked dev on the same `tmp/data`, or a crash mid-write). Run `pnpm clear:data` and restart — do not mix offline and networked dev on the same `CO_BASE_PATH` without resetting first.

### Caveats

- **`CO_NO_KEYCHAIN=true`**: dev keys live under each `tmp/data*` directory, not the system keychain. Do not use these keys in production.
- **Start A before B/C**: B and C expect Vite already listening on port 1420 (`pnpm tauri:dev` handles this automatically).
- **One Vite, many shells**: all instances share the same frontend HMR session; only Rust/CO state is isolated per `CO_BASE_PATH`.
- **Network required for cross-instance joins**: use `pnpm tauri:dev:single` for single-user offline UI work; default `pnpm tauri:dev` runs two networked instances.
- **macOS**: both windows use the same app bundle id in dev; distinguish them by window title (`CO Messenger (B)` etc.).

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
