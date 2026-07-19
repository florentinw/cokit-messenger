---
name: co-cli
description: Inspect and debug CO Messenger local/group CO state with the COKIT `co` CLI (tags, memberships, identities, room history). Use when verifying profile/display-name persistence, memberships, invites, or room events against on-disk CO stores under tmp/data*.
---

# CO CLI (messenger)

Use the COKIT `co` binary to read the same encrypted stores the Tauri app writes. Prefer this over grepping `tmp/data/**` (blocks are encrypted).

Upstream: https://github.com/1iolabs/cokit/tree/main/co-cli

## Prerequisites

- `co` on `PATH` (see `.cursor/install-co-cli.sh` / `AGENTS.md`).
- Messenger data already created (run `pnpm tauri:dev:single` at least once, or use an existing `tmp/data*`).
- Do **not** open the same `CO_BASE_PATH` while `tauri:dev` is running against it — stop the app first to avoid store conflicts.

## Required env (match the desktop app)

The app uses instance id `cokit-messenger` and stores under `{CO_BASE_PATH}/etc/cokit-messenger/`. Default `co` instance id is `co-cli` and will miss the messenger store.

```bash
export CO_NO_KEYCHAIN=true
export CO_INSTANCE_ID=cokit-messenger
export CO_BASE_PATH="$PWD/tmp/data"   # or tmp/data-b / tmp/data-c for other instances
```

Or pass flags every time:

```bash
co --no-keychain --instance-id cokit-messenger --base-path "$PWD/tmp/data" <command>
```

| Instance script | `CO_BASE_PATH` |
|-----------------|----------------|
| `pnpm tauri:dev:single` / `:a` | `$PWD/tmp/data` |
| `pnpm tauri:dev:b` | `$PWD/tmp/data-b` |
| `pnpm tauri:dev:c` | `$PWD/tmp/data-c` |

## Common workflows

### List memberships (sidebar chats / invites)

```bash
co co ls
```

### Show local CO (tags, participants, cores)

Profile display name is a **local CO tag** `display_name` (not `localStorage`).

```bash
co co show local
```

Look under `# CO` → `- Tags:` for `display_name`. Group member names on shared COs use `display_name:<did>`.

### Show a group CO or a named core

```bash
co co show <co-id>
co co show <co-id> --core room
co co show <co-id> --core membership
co co show <co-id> --core co
```

### Identities in the local keystore

```bash
co did ls
```

Messenger creates `messenger-identity` (see `IDENTITY_NAME` in `src/lib/messenger/types.ts`).

### Room timeline

```bash
co room get <co-id> -c 20
```

### CO action log / block dump

```bash
co co log <co-id>
co co cat <cid> --pretty
```

## Verification checklist (profile name)

1. Stop the Tauri app for that data dir.
2. Export env for the instance (above).
3. `co co show local` → confirm `display_name` tag.
4. Optionally `co co show <group-id>` → confirm `display_name:<did>` after publishing to groups.

## When not to use

- UI-only checks → use the desktop app / `control-ui`.
- Typecheck → `pnpm exec tsc --noEmit`.
- Wiping stores → `pnpm clear:data` (not `co`).
