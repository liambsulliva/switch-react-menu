import { useSyncExternalStore } from "react";
import { resetRichDetailsSessionForHardReload } from "./richDetailsBundledCatalog";
import { clearRichPersistentCache } from "./richDetailsPersistentCache";

let hardReloadNonce = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function requestRichDetailsCatalogHardReload(): void {
  clearRichPersistentCache();
  resetRichDetailsSessionForHardReload();
  hardReloadNonce += 1;
  emit();
}

export function subscribeRichDetailsHardReloadNonce(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRichDetailsHardReloadNonce(): number {
  return hardReloadNonce;
}

export function useRichDetailsHardReloadNonce(): number {
  return useSyncExternalStore(
    subscribeRichDetailsHardReloadNonce,
    getRichDetailsHardReloadNonce,
    getRichDetailsHardReloadNonce,
  );
}
