import { useSyncExternalStore } from "react";
import { usesRawgProxy } from "../lib/rawgConfig";

const STORAGE_KEY = "switch-react-menu-rawg-api-key-v1";

function storage(): Storage | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

export function getBuiltInRawgApiKey(): string {
  const fromEnv = import.meta.env.VITE_RAWG_API_KEY;
  return typeof fromEnv === "string" ? fromEnv.trim() : "";
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
  return getBuiltInRawgApiKey();
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
  if (usesRawgProxy()) return true;
  return getRawgApiKey().length > 0;
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
  apiKeyState = trimmed || getBuiltInRawgApiKey();
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
