// Make DOM work good 😛 lol
// Not much else to say

export type BrowserCanvas = EventTarget & {
  width: number;
  height: number;
  focus(): void;
  getContext(contextId: string): unknown;
  dispatchEvent(event: Event): boolean;
  addEventListener(
    type: string,
    listener: (e: Event) => void,
    options?: boolean | { passive?: boolean },
  ): void;
};

export type BrowserDocument = {
  getElementById(id: string): unknown;
  fonts: { add(face: FontFace): unknown };
  addEventListener(
    type: string,
    listener: () => void,
    options?: { passive?: boolean },
  ): void;
};

export function getBrowserDocument(): BrowserDocument | undefined {
  const doc = (globalThis as Record<string, unknown>)["document"];
  if (!doc || typeof doc !== "object" || doc === null) return undefined;
  if (
    !("getElementById" in doc) ||
    !("fonts" in doc) ||
    !("addEventListener" in doc)
  ) {
    return undefined;
  }
  return doc as BrowserDocument;
}

export function isBrowserCanvas(node: unknown): node is BrowserCanvas {
  if (!node || typeof node !== "object") return false;
  const o = node as Record<string, unknown>;
  if (o["nodeName"] !== "CANVAS") return false;
  return (
    typeof o["getContext"] === "function" &&
    typeof o["addEventListener"] === "function" &&
    typeof o["dispatchEvent"] === "function"
  );
}
