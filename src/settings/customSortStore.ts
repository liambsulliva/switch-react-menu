import { useSyncExternalStore } from "react";

const STORAGE_KEY = "switch-react-menu-custom-order";

function loadOrder(): string[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as string[];
    }
  } catch {
    // ignore corrupt save data
  }
  return [];
}

let orderState: string[] = loadOrder();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function getCustomOrder(): string[] {
  return orderState;
}

export function setCustomOrder(order: string[]): void {
  if (
    orderState.length === order.length &&
    orderState.every((id, i) => id === order[i])
  ) {
    return;
  }
  orderState = order;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    }
  } catch {
    // best-effort persistence
  }
  emit();
}

export function subscribeCustomOrder(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCustomOrder(): string[] {
  return useSyncExternalStore(
    subscribeCustomOrder,
    getCustomOrder,
    getCustomOrder,
  );
}
