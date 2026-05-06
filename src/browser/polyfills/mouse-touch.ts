// Converts clicks on the canvas to touch events.
// Uses Touch/TouchEvent if its available (like on mobile view)

import type { BrowserCanvas } from "../dom";

// nx.js's MouseEvent omits button.
// browsers always provide it (e.g. 0 = left click).
interface MouseLike {
  button: number;
  clientX: number;
  clientY: number;
}

let nextTouchId = 1;

interface TouchInit {
  identifier: number;
  target: EventTarget;
  clientX: number;
  clientY: number;
  radiusX: number;
  radiusY: number;
  rotationAngle: number;
  force: number;
}

function makeTouch(init: TouchInit): Touch {
  if (typeof Touch === "function") {
    return new Touch(init);
  }
  return init as unknown as Touch;
}

function makeTouchEvent(
  type: string,
  target: EventTarget,
  touch: Touch,
): Event {
  if (typeof TouchEvent === "function") {
    try {
      return new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        touches: type === "touchend" ? [] : [touch],
        targetTouches: type === "touchend" ? [] : [touch],
        changedTouches: [touch],
      });
    } catch {
      // This just leaves the exception unhandled... which is fine here imo
      // We don't need click = touch cuz keyboard nav is afforded by the interface anyway
    }
  }
  // Will make a new event for a custom touch
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    changedTouches: Touch[];
    targetTouches: Touch[];
    touches: Touch[];
  };
  Object.defineProperties(ev, {
    changedTouches: { value: [touch] },
    targetTouches: { value: type === "touchend" ? [] : [touch] },
    touches: { value: type === "touchend" ? [] : [touch] },
  });
  return ev;
}

export function installMouseToTouchPolyfill(canvas: BrowserCanvas): void {
  const activeTouchByButton = new Map<number, Touch>();

  canvas.addEventListener("mousedown", (e: Event) => {
    const m = e as unknown as MouseLike;
    if (m.button !== 0) return; // left click
    const id = nextTouchId++;
    const touch = makeTouch({
      identifier: id,
      target: canvas,
      clientX: m.clientX,
      clientY: m.clientY,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    });
    activeTouchByButton.set(m.button, touch);
    canvas.dispatchEvent(makeTouchEvent("touchstart", canvas, touch));
  });

  const finish = (e: Event) => {
    const m = e as unknown as MouseLike;
    const touch = activeTouchByButton.get(m.button);
    if (!touch) return;
    activeTouchByButton.delete(m.button);
    canvas.dispatchEvent(makeTouchEvent("touchend", canvas, touch));
  };

  canvas.addEventListener("mouseup", finish);
  canvas.addEventListener("mouseleave", (e: Event) => {
    if (activeTouchByButton.size > 0) finish(e);
  });
}
