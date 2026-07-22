import { useSyncExternalStore } from "react";
import { usesRawgProxy } from "../lib/rawgTransport";

const STORAGE_KEY = "switch-react-menu-rawg-api-key-v1";

function storage(): Storage | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function loadRawgApiKey(): string {
  const ls = storage();
  if (ls) {
    try {
      const raw = ls.getItem(STORAGE_KEY);
      if (typeof raw === "string" && raw.trim()) return raw.trim();
    } catch {
      /* quota / private mode */
    }
  }
  return "";
}

let apiKeyState = loadRawgApiKey();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getRawgApiKey(): string {
  return apiKeyState;
}

export function hasRawgApiKey(): boolean {
  return usesRawgProxy() || getRawgApiKey().length > 0;
}

export function hasStoredRawgApiKeyOverride(): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    return typeof raw === "string" && raw.trim().length > 0;
  } catch {
    return false;
  }
}

export function setRawgApiKey(key: string): void {
  const trimmed = key.trim();
  const ls = storage();
  if (ls) {
    try {
      if (trimmed) ls.setItem(STORAGE_KEY, trimmed);
      else ls.removeItem(STORAGE_KEY);
    } catch {
      /* quota */
    }
  }
  apiKeyState = trimmed;
  emit();
}

export function clearRawgApiKey(): void {
  setRawgApiKey("");
}

export function subscribeRawgApiKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRawgApiKey(): string {
  return useSyncExternalStore(
    subscribeRawgApiKey,
    getRawgApiKey,
    getRawgApiKey,
  );
}
