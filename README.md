# CO Messenger

Experimental desktop messenger built on [COKIT](https://github.com/1iolabs/cokit) and [Tauri](https://tauri.app).

## Develop

```bash
pnpm install
pnpm tauri:dev          # two networked windows (separate identities)
pnpm tauri:dev:single   # one offline window
pnpm clear:data         # wipe local CO stores / identities
bash .cursor/install-co-cli.sh   # optional: COKIT `co` CLI for inspecting stores
```

Dev instances use `CO_NO_KEYCHAIN=true` and per-instance `CO_BASE_PATH` under `tmp/` so you can run A/B/C in parallel. Production builds do **not** set those — network and Keychain are on by default.

| Env | Effect |
|-----|--------|
| `CO_BASE_PATH` | Custom data directory (dev multi-instance) |
| `CO_NO_KEYCHAIN=true` | Store keys on disk instead of macOS Keychain |
| `CO_DISABLE_NETWORK=true` | Offline mode (used by `tauri:dev:single`) |
| `CO_INSTANCE_ID` | App id under `{CO_BASE_PATH}/etc/<id>/` — messenger uses `cokit-messenger` |

To inspect the same stores the app writes, use [`co-cli`](https://github.com/1iolabs/cokit/tree/main/co-cli) with `CO_INSTANCE_ID=cokit-messenger` (see `.cursor/skills/co-cli/SKILL.md`).
