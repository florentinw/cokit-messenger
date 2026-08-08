# CO Messenger

Experimental desktop messenger built on [COKIT](https://github.com/1iolabs/cokit) and [Tauri](https://tauri.app). Frontend is React 19 + Vite + Tailwind; the backend is a Rust Tauri app that embeds the CO SDK (peer-to-peer, libp2p-based). See `README.md` for the developer command reference.

To inspect the same encrypted stores the app writes to disk (under `tmp/data*`), use the COKIT [`co-cli`](https://github.com/1iolabs/cokit/tree/main/co-cli) — see `.cursor/skills/co-cli/SKILL.md` for setup and commands.

## Cursor Cloud specific instructions

This repo is macOS-first (CI builds on `macos-latest`; the README references Keychain/macOS icons), but it runs fine on the Linux cloud VM. Platform-specific code (vibrancy, `lsappinfo` display name) is already gated behind `#[cfg(target_os = "macos")]`, so no code changes are needed to build/run on Linux.

Run/build commands live in `README.md` and `package.json` (`pnpm dev`, `pnpm tauri:dev`, `pnpm tauri:dev:single`, `pnpm clear:data`). The one non-obvious gate: there is no ESLint script, so `pnpm exec tsc --noEmit` is the typecheck/lint step (full build: `pnpm build`).

### CO CLI (`co`)

Install into the cloud environment (or any Linux/macOS agent box) with:

```bash
bash .cursor/install-co-cli.sh
```

Or paste this into the Cursor Cloud environment **install** command (alongside `pnpm install`):

```bash
pnpm install && bash .cursor/install-co-cli.sh
```

That matches `.cursor/environment.json`. The script prefers `cargo binstall` when available, otherwise builds `co-cli` from the cokit rev pinned in `.cursor/install-co-cli.sh` (`COKIT_REV`, kept in sync with the `tauri-plugin-co-sdk` rev in `src-tauri/Cargo.toml`).

The source build passes `--locked` on purpose: co-cli's transitive `core2 0.4.0` (via `multihash-codetable`) is yanked on crates.io, so a fresh resolve fails; `--locked` reuses cokit's lockfile, where the yanked version is still allowed. The app's own Rust build instead works around the same yank with the `[patch.crates-io]` fork in `src-tauri/Cargo.toml`. Keep both in mind when bumping the cokit rev.

For usage — required env, instance ids, data-dir mapping, and common commands — see `.cursor/skills/co-cli/SKILL.md`. Quick start: export `CO_NO_KEYCHAIN=true CO_INSTANCE_ID=cokit-messenger CO_BASE_PATH="$PWD/tmp/data"`, then run e.g. `co co show local`. The app's instance id is `cokit-messenger` (the default `co-cli` would miss its store); stop `tauri:dev` for that data dir before opening it with `co`.

Non-obvious caveats for running on the Linux VM:
- The GUI needs an X display. A virtual display is available at `DISPLAY=:1`; export it before launching the app.
- WebKitGTK software-rendering fallback: launch with `WEBKIT_DISABLE_COMPOSITING_MODE=1` and `WEBKIT_DISABLE_DMABUF_RENDERER=1` to avoid GPU/compositing crashes on the headless VM. Harmless `libEGL warning: DRI3 error` lines are expected and non-fatal.
- Rust toolchain: dependencies (e.g. `chacha20`) require edition2024, so Rust >= 1.85 is required. The VM's default `rustup` toolchain is set to `stable` (currently 1.97+); the old system cargo 1.83 will fail with an `edition2024` error.
- Cargo keeps build artifacts in-tree at `src-tauri/target` (see `src-tauri/.cargo/config.toml`). The first `cargo build` fetches a large dependency tree (COKIT git dep + libp2p) and takes several minutes; subsequent incremental builds are fast (~10-15s).
- The frontend alone (in a plain browser) cannot function: the app talks to the Rust backend over Tauri IPC and will show "Open the desktop app". Always run it through `tauri dev`.

Hello-world sanity check: launch `pnpm tauri:dev:single`, let it auto-create an identity (a `did:key:...` shows at the bottom of the sidebar), click "Create a group", name it, then type and send a message in the chat.
