import type { CID } from "multiformats";
import { resolveCid } from "./invoke";

interface Node<I> {
  n?: CID[];
  l?: I[];
}

export class DagList<I> {
  private nodes: CID[];
  private elements: I[];
  private session: string;

  constructor(root: Node<I>, session: string) {
    this.nodes = root.n ? [...root.n] : [];
    this.elements = root.l ? [...root.l] : [];
    this.session = session;
  }

  async resolveNext(): Promise<boolean> {
    const nodeCid = this.nodes.pop();
    if (nodeCid === undefined) return false;
    const newNode = (await resolveCid(this.session, nodeCid)) as Node<I>;
    if (newNode?.n !== undefined) this.nodes.push(...newNode.n);
    if (newNode?.l !== undefined) this.elements.push(...newNode.l);
    return true;
  }

  async get(index: number): Promise<I | undefined> {
    do {
      if (this.elements.length > index) return this.elements[index];
    } while ((await this.resolveNext()) === true);
    return undefined;
  }

  async find(predicate: (i: I) => boolean): Promise<I | undefined> {
    let count = 0;
    while (true) {
      const next = await this.get(count);
      if (next === undefined) return undefined;
      if (predicate(next)) return next;
      count++;
    }
  }
}
