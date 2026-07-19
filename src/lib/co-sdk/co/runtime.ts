import { isTauri } from "@tauri-apps/api/core";

/** Thrown when IPC is invoked outside a Tauri webview (UI copy lives in messenger). */
const TAURI_REQUIRED_MESSAGE =
  "This app must run inside a Tauri desktop window, not a normal browser tab.";

/** Set after the first successful Tauri check so later IPC skips the probe. */
let tauriRuntimeReady = false;

/**
 * True when the page is running under Tauri with a working `invoke` bridge.
 *
 * @returns `true` if Tauri + `__TAURI_INTERNALS__.invoke` are available
 */
export function isTauriRuntimeAvailable(): boolean {
  return (
    isTauri() &&
    typeof (window as Window & { __TAURI_INTERNALS__?: { invoke?: unknown } })
      .__TAURI_INTERNALS__?.invoke === "function"
  );
}

/** Assert Tauri once, then cache success for later IPC calls. */
export function assertTauriRuntime(): void {
  if (tauriRuntimeReady) return;
  if (!isTauriRuntimeAvailable()) {
    throw new Error(TAURI_REQUIRED_MESSAGE);
  }
  tauriRuntimeReady = true;
}
