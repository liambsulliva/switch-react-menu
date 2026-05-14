// Keyboard to virtual Switch Gamepad shim: overrides `navigator.getGamepads` to make room for a browser-driven gamepad whose button/axis state matches the `@nx.js/constants` Button enum

import { Button } from "@nx.js/constants";

const NUM_BUTTONS = 16;
const NUM_AXES = 4;

const buttonState: { pressed: boolean; touched: boolean; value: number }[] =
  Array.from({ length: NUM_BUTTONS }, () => ({
    pressed: false,
    touched: false,
    value: 0,
  }));

const axisState: number[] = Array.from({ length: NUM_AXES }, () => 0);

function setButton(index: number, pressed: boolean): void {
  const slot = buttonState[index];
  if (!slot) return;
  slot.pressed = pressed;
  slot.touched = pressed;
  slot.value = pressed ? 1 : 0;
}

// Each key may map to a button index (Switch button) and/or an axis nudge.
interface KeyBinding {
  button?: number;
  axis?: { index: number; value: number };
}

const KEY_MAP: Readonly<Record<string, KeyBinding>> = {
  // D-pad / left stick X
  ArrowLeft: { button: Button.Left, axis: { index: 0, value: -1 } },
  ArrowRight: { button: Button.Right, axis: { index: 0, value: 1 } },
  ArrowUp: { button: Button.Up, axis: { index: 1, value: -1 } },
  ArrowDown: { button: Button.Down, axis: { index: 1, value: 1 } },
  KeyA: { button: Button.Left, axis: { index: 0, value: -1 } },
  KeyD: { button: Button.Right, axis: { index: 0, value: 1 } },
  KeyW: { button: Button.Up, axis: { index: 1, value: -1 } },
  KeyS: { button: Button.Down, axis: { index: 1, value: 1 } },

  // Face buttons
  Enter: { button: Button.A },
  Space: { button: Button.A },
  KeyZ: { button: Button.A },
  KeyX: { button: Button.B },
  KeyC: { button: Button.Y },
  KeyV: { button: Button.X },

  // Shoulders
  KeyQ: { button: Button.L },
  KeyE: { button: Button.R },
  Digit1: { button: Button.ZL },
  Digit2: { button: Button.ZR },

  // Plus / minus
  Escape: { button: Button.Minus },
  Tab: { button: Button.Plus },
};

function buildVirtualGamepad(): Gamepad {
  return {
    id: "Switch Virtual Gamepad (keyboard)",
    index: 0,
    connected: true,
    timestamp: performance.now(),
    mapping: "standard",
    axes: axisState.slice(),
    buttons: buttonState.map((b) => ({ ...b })),
    vibrationActuator: null,
  } as unknown as Gamepad;
}

function recomputeAxes(): void {
  // Stick axes are recomputed each frame
  const components: number[] = [0, 0, 0, 0];
  for (const code in heldKeys) {
    if (!heldKeys[code]) continue;
    const binding = KEY_MAP[code];
    if (binding?.axis) {
      components[binding.axis.index] += binding.axis.value;
    }
  }
  for (let i = 0; i < axisState.length; i++) {
    axisState[i] = Math.max(-1, Math.min(1, components[i] ?? 0));
  }
}

const heldKeys: Record<string, boolean> = {};

function eventTargetIsTextField(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { nodeName?: string; isContentEditable?: boolean };
  const name = el.nodeName;
  if (name === "INPUT" || name === "TEXTAREA" || name === "SELECT")
    return true;
  return el.isContentEditable === true;
}

export function installKeyboardGamepadPolyfill(): void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (eventTargetIsTextField(e.target)) return;
    const binding = KEY_MAP[e.code];
    if (!binding) return;
    e.preventDefault();
    if (heldKeys[e.code]) return;
    heldKeys[e.code] = true;
    if (typeof binding.button === "number") setButton(binding.button, true);
    recomputeAxes();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (eventTargetIsTextField(e.target)) return;
    const binding = KEY_MAP[e.code];
    if (!binding) return;
    e.preventDefault();
    heldKeys[e.code] = false;
    // Defer the release by one animation frame so that very fast synthetic keydown/keyup pairs are still observed by the rAF-driven gamepad loop in useGamepadNavigation. For real human key presses this is a no-op.
    const buttonIndex = binding.button;
    requestAnimationFrame(() => {
      if (heldKeys[e.code]) return; // user re-pressed before the rAF
      if (typeof buttonIndex === "number") setButton(buttonIndex, false);
      recomputeAxes();
    });
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Make sure all keys are released if focus is lost so a held arrow key doesn't get "stuck" when alt-tabbing.
  window.addEventListener("blur", () => {
    for (const code in heldKeys) heldKeys[code] = false;
    for (const slot of buttonState) {
      slot.pressed = false;
      slot.touched = false;
      slot.value = 0;
    }
    recomputeAxes();
  });

  // Override navigator.getGamepads so the existing useGamepadNavigation hook works unchanged.
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    writable: true,
    value: function getGamepads(): (Gamepad | null)[] {
      return [buildVirtualGamepad(), null, null, null];
    },
  });
}
