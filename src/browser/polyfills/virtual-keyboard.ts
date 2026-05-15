import { SWITCH_VK_DELETE_BACKWARD } from "../../lib/switchVirtualKeyboardEvents";

type NxStyleVirtualKeyboard = EventTarget & {
  value: string;
  cursorIndex: number;
  show(): void;
  hide(): void;
};

function navigatorHasNxStyleVk(vk: unknown): vk is NxStyleVirtualKeyboard {
  if (!vk || typeof vk !== "object") return false;
  const o = vk as Record<string, unknown>;
  return (
    typeof o.show === "function" &&
    typeof o.hide === "function" &&
    typeof o.value === "string"
  );
}

class BrowserVirtualKeyboardStub extends EventTarget {
  private _value = "";
  private _cursorIndex = 0;
  private input: HTMLInputElement | null = null;

  get value(): string {
    return this._value;
  }

  set value(v: string) {
    this._value = v;
    this._cursorIndex = v.length;
    if (this.input) this.input.value = v;
    this.dispatchEvent(new Event("change"));
  }

  get cursorIndex(): number {
    return this._cursorIndex;
  }

  set cursorIndex(i: number) {
    this._cursorIndex = i;
  }

  show(): void {
    if (typeof document === "undefined" || !document.body) return;
    if (!this.input) {
      const el = document.createElement("input");
      el.type = "text";
      el.setAttribute("autocomplete", "off");
      el.setAttribute("aria-label", "Search");
      el.style.cssText =
        "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:auto;";
      el.value = this._value;
      el.addEventListener("input", () => {
        this._value = el.value;
        this._cursorIndex = el.selectionStart ?? this._value.length;
        this.dispatchEvent(new Event("change"));
        this.dispatchEvent(new Event("cursormove"));
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.dispatchEvent(new Event("submit"));
          return;
        }
        if (e.key === "Backspace" && el.value.length === 0) {
          e.preventDefault();
          this.dispatchEvent(new Event(SWITCH_VK_DELETE_BACKWARD));
        }
      });
      document.body.appendChild(el);
      this.input = el;
    }
    this.input.value = this._value;
    queueMicrotask(() => this.input?.focus());
  }

  hide(): void {
    if (this.input) {
      this.input.remove();
      this.input = null;
    }
  }
}

export function installBrowserVirtualKeyboardStub(): void {
  const nav = navigator as Navigator & {
    virtualKeyboard?: unknown;
  };
  if (navigatorHasNxStyleVk(nav.virtualKeyboard)) return;
  Object.defineProperty(navigator, "virtualKeyboard", {
    configurable: true,
    enumerable: true,
    value: new BrowserVirtualKeyboardStub(),
  });
}
