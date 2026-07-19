import { DagList as SdkDagList, type Node } from "@1io/tauri-plugin-co-sdk";
import type { CID } from "multiformats";

export type { Node };
export { SdkDagList as DagList };

/** Normalize optional LSM node fields to the official `Node` shape. */
export function asDagNode<I>(root: {
  n?: CID[];
  l?: I[];
}): Node<I> {
  return { n: root.n, l: root.l };
}
