import { useSyncExternalStore } from "react";

const STORAGE_KEY = "switch-react-menu-last-played";

function storage(): Storage | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function loadId(): string | null {
  const ls = storage();
  if (!ls) return null;
  try {
    return ls.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let lastPlayedApplicationId: string | null = loadId();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getLastPlayedApplicationId(): string | null {
  return lastPlayedApplicationId;
}

/** Persist and broadcast the application id (decimal string of `Switch.Application.id`). */
export function recordLastPlayed(app: { id: bigint }): void {
  const id = app.id.toString();
  if (lastPlayedApplicationId === id) {
    return;
  }
  lastPlayedApplicationId = id;
  const ls = storage();
  if (ls) {
    try {
      ls.setItem(STORAGE_KEY, id);
    } catch {
      // best-effort persistence
    }
  }
  emit();
}

export function subscribeLastPlayed(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLastPlayedApplicationId(): string | null {
  return useSyncExternalStore(
    subscribeLastPlayed,
    getLastPlayedApplicationId,
    getLastPlayedApplicationId,
  );
}
