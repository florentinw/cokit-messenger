import {
  createCoSdkStateEventListener,
  type CoSdkStateEvent,
} from "@1io/tauri-plugin-co-sdk";
import type { Subscription } from "rxjs";

/**
 * Promise-style wrapper around the official RxJS `co-sdk-new-state` listener.
 *
 * @param onEvent - Callback invoked with each `[coId, tipCid, heads]` state event
 * @returns Promise that resolves to an unsubscribe function
 */
export async function listenCoSdkState(
  onEvent: (event: CoSdkStateEvent) => void,
): Promise<() => void> {
  const subscription: Subscription = createCoSdkStateEventListener().subscribe({
    next: onEvent,
    error: (err) => {
      console.warn("co-sdk-new-state listener error", err);
    },
  });
  return () => {
    subscription.unsubscribe();
  };
}
