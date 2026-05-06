import type { BrowserCanvas } from "../dom";
import { installScreenPolyfill } from "./screen";
import { installFontsPolyfill } from "./fonts";
import { installSwitchPolyfill } from "./switch";
import { installKeyboardGamepadPolyfill } from "./keyboard-gamepad";
import { installMouseToTouchPolyfill } from "./mouse-touch";

// Order matters here! Installs screen first (so `screen` is available when other
// polyfills or the app touch it), then fonts, then Switch (which is async
// because it pre-renders mock icons), then the keyboard->gamepad shim :DD
export async function installNxJsPolyfills(
  canvas: BrowserCanvas,
): Promise<void> {
  installScreenPolyfill(canvas);
  installFontsPolyfill();
  await installSwitchPolyfill();
  installKeyboardGamepadPolyfill();
  installMouseToTouchPolyfill(canvas);
}
