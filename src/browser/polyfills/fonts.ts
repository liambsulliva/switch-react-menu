// Polyfill for the nx.js `fonts` global.

import { getBrowserDocument } from "../dom";

export function installFontsPolyfill(): void {
  const doc = getBrowserDocument();
  if (!doc) {
    throw new Error("document.fonts is required for browser preview");
  }
  Object.defineProperty(globalThis, "fonts", {
    value: doc.fonts,
    configurable: true,
    writable: true,
  });
}
