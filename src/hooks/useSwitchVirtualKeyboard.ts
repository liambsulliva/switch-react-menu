import { useCallback, useEffect, useRef, useState } from "react";
import { SWITCH_VK_DELETE_BACKWARD } from "../lib/switchVirtualKeyboardEvents";

type NxVirtualKeyboard = EventTarget & {
  value: string;
  cursorIndex: number;
  show(): void;
  hide(): void;
};

export function getNxVirtualKeyboard(): NxVirtualKeyboard | null {
  const nav = navigator as Navigator & { virtualKeyboard?: NxVirtualKeyboard };
  const vk = nav.virtualKeyboard;
  if (!vk || typeof vk.show !== "function") return null;
  if (typeof vk.value !== "string") return null;
  return vk;
}

export type UseSwitchVirtualKeyboardOptions = {
  onDeleteBackwardAtEmpty?: () => void;
};

export function useSwitchVirtualKeyboard(
  active: boolean,
  options?: UseSwitchVirtualKeyboardOptions,
) {
  const [text, setText] = useState("");
  const vkRef = useRef<NxVirtualKeyboard | null>(null);
  const onDeleteBackwardAtEmptyRef = useRef(options?.onDeleteBackwardAtEmpty);
  onDeleteBackwardAtEmptyRef.current = options?.onDeleteBackwardAtEmpty;

  const syncFromVk = useCallback(() => {
    const vk = vkRef.current;
    if (!vk) return;
    setText(vk.value);
  }, []);

  const clear = useCallback(() => {
    const vk = vkRef.current ?? getNxVirtualKeyboard();
    if (vk) vk.value = "";
    setText("");
  }, []);

  const deleteLastChar = useCallback(() => {
    const vk = vkRef.current ?? getNxVirtualKeyboard();
    if (!vk) return;
    if (vk.value.length > 0) {
      vk.value = vk.value.slice(0, -1);
      setText(vk.value);
      try {
        vk.dispatchEvent(new Event("change"));
      } catch {
        /* ignore */
      }
      return;
    }
    onDeleteBackwardAtEmptyRef.current?.();
  }, []);

  useEffect(() => {
    const vk = getNxVirtualKeyboard();
    vkRef.current = vk;
    if (!active) {
      return undefined;
    }
    if (!vk) {
      setText("");
      return undefined;
    }

    setText(vk.value);
    const onChange = () => syncFromVk();
    vk.addEventListener("change", onChange);
    vk.addEventListener("cursormove", onChange);
    const onSubmit = () => syncFromVk();
    vk.addEventListener("submit", onSubmit);
    const onDeleteBackward = () => {
      onDeleteBackwardAtEmptyRef.current?.();
    };
    vk.addEventListener(SWITCH_VK_DELETE_BACKWARD, onDeleteBackward);
    try {
      vk.show();
    } catch {
      /* ignore */
    }

    return () => {
      vk.removeEventListener("change", onChange);
      vk.removeEventListener("cursormove", onChange);
      vk.removeEventListener("submit", onSubmit);
      vk.removeEventListener(SWITCH_VK_DELETE_BACKWARD, onDeleteBackward);
      try {
        vk.hide();
      } catch {
        /* ignore */
      }
    };
  }, [active, syncFromVk]);

  return { text, clear, deleteLastChar };
}
