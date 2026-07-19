import { listen, type Event } from "@tauri-apps/api/event";
import { decode } from "@ipld/dag-cbor";
import type { CID } from "multiformats";
import type { CoSdkStateEvent } from "./types";

/**
 * Listen for CO state changes.
 * Tauri emits CBOR-encoded `[coId, stateCid, heads]` as a number[] payload —
 * matching the official guest-js decoder.
 */
export async function listenCoSdkState(
  onEvent: (event: CoSdkStateEvent) => void,
): Promise<() => void> {
  return listen("co-sdk-new-state", (event: Event<number[]>) => {
    try {
      const data = decode(Uint8Array.from(event.payload)) as [
        string,
        CID | undefined,
        CID[],
      ];
      onEvent(data);
    } catch (err) {
      console.warn("Failed to decode co-sdk-new-state payload", err);
    }
  }).then((unlisten) => unlisten);
}
