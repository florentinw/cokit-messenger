# CO Messenger

Experimental desktop messenger built on [COKIT](https://github.com/1iolabs/cokit) and [Tauri](https://tauri.app). Frontend is React 19 + Vite + Tailwind; the backend is a Rust Tauri app that embeds the CO SDK (peer-to-peer, libp2p-based). See `README.md` for the developer command reference.

## Cursor Cloud specific instructions

This repo is macOS-first (CI builds on `macos-latest`; the README references Keychain/macOS icons), but it runs fine on the Linux cloud VM. Platform-specific code (vibrancy, `lsappinfo` display name) is already gated behind `#[cfg(target_os = "macos")]`, so no code changes are needed to build/run on Linux.

Services / commands (all already documented in `README.md` and `package.json`):
- Frontend dev server: `pnpm dev` (Vite on port 1420). Tauri starts this automatically via `beforeDevCommand`.
- Desktop app (single, offline): `pnpm tauri:dev:single` — one window, `CO_DISABLE_NETWORK=true`, data under `tmp/data`.
- Desktop app (two networked windows): `pnpm tauri:dev` — separate identities for A/B messaging.
- Typecheck/lint: `pnpm exec tsc --noEmit` (the repo has no separate ESLint script; `tsc` is the type gate). Full build: `pnpm build`.
- Wipe local CO stores/identities: `pnpm clear:data`.

Non-obvious caveats for running on the Linux VM:
- The GUI needs an X display. A virtual display is available at `DISPLAY=:1`; export it before launching the app.
- WebKitGTK software-rendering fallback: launch with `WEBKIT_DISABLE_COMPOSITING_MODE=1` and `WEBKIT_DISABLE_DMABUF_RENDERER=1` to avoid GPU/compositing crashes on the headless VM. Harmless `libEGL warning: DRI3 error` lines are expected and non-fatal.
- Rust toolchain: dependencies (e.g. `chacha20`) require edition2024, so Rust >= 1.85 is required. The VM's default `rustup` toolchain is set to `stable` (currently 1.97+); the old system cargo 1.83 will fail with an `edition2024` error.
- Cargo keeps build artifacts in-tree at `src-tauri/target` (see `src-tauri/.cargo/config.toml`). The first `cargo build` fetches a large dependency tree (COKIT git dep + libp2p) and takes several minutes; subsequent incremental builds are fast (~10-15s).
- The frontend alone (in a plain browser) cannot function: the app talks to the Rust backend over Tauri IPC and will show "Open the desktop app". Always run it through `tauri dev`.

Hello-world sanity check: launch `pnpm tauri:dev:single`, let it auto-create an identity (a `did:key:...` shows at the bottom of the sidebar), click "Create a group", name it, then type and send a message in the chat.
