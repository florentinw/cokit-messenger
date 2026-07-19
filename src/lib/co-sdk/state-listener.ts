import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";
import { decode } from "@ipld/dag-cbor";
import type { CID } from "multiformats";
import { isMockCoEnabled, mockStore } from "./mock";
import type { CoSdkStateEvent } from "./types";

export async function listenCoSdkState(
  onEvent: (event: CoSdkStateEvent) => void,
): Promise<UnlistenFn> {
  if (isMockCoEnabled()) {
    return mockStore.listenCoSdkState(onEvent);
  }
  return listen("co-sdk-new-state", (event: Event<number[]>) => {
    const data = decode(Uint8Array.from(event.payload)) as [
      string,
      CID | undefined,
      CID[],
    ];
    onEvent(data);
  });
}
