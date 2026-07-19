#!/usr/bin/env bash
# Install the COKIT `co` CLI for inspecting messenger CO stores.
# Pin to the same cokit rev as src-tauri/Cargo.toml when building from source.
set -euo pipefail

COKIT_GIT="${COKIT_GIT:-https://github.com/1iolabs/cokit.git}"
# Keep in sync with tauri-plugin-co-sdk rev in src-tauri/Cargo.toml.
COKIT_REV="${COKIT_REV:-049fece420c489a9a35ae2be8ca2e3bdf11eb04e}"

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo is required to install co-cli" >&2
  exit 1
fi

if command -v co >/dev/null 2>&1; then
  echo "co already on PATH: $(command -v co)"
  exit 0
fi

# Fast path: prebuilt binary from cokit releases (may be newer than COKIT_REV).
if cargo binstall -V >/dev/null 2>&1; then
  echo "Trying cargo-binstall for co-cli…"
  if cargo binstall -y co-cli --git "$COKIT_GIT"; then
    echo "Installed co via cargo-binstall: $(command -v co)"
    exit 0
  fi
  echo "cargo-binstall failed; falling back to cargo install from source."
fi

echo "Building co-cli from $COKIT_GIT @ $COKIT_REV (several minutes on first run)…"
cargo install co-cli \
  --git "$COKIT_GIT" \
  --rev "$COKIT_REV" \
  --force

echo "Installed co: $(command -v co)"
