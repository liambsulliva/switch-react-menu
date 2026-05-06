// Polyfills screen rendering to the canvas

import type { BrowserCanvas } from "../dom";
import { getBrowserDocument } from "../dom";

export const SWITCH_WIDTH = 1280;
export const SWITCH_HEIGHT = 720;

// Custom "preview canvas" renders to a 1280x720 internal buffer
type PreviewCanvas = {
  width: number;
  height: number;
  focus(): void;
};

export function installScreenPolyfill(canvas: BrowserCanvas): void {
  const el = canvas as unknown as PreviewCanvas;
  el.width = SWITCH_WIDTH;
  el.height = SWITCH_HEIGHT;

  Object.defineProperty(globalThis, "screen", {
    value: canvas,
    configurable: true,
    writable: true,
  });

  el.focus();
  getBrowserDocument()?.addEventListener("click", () => el.focus(), {
    passive: true,
  });
}
