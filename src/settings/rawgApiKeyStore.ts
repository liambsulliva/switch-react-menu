import { useSyncExternalStore } from "react";
import { usesRawgProxy } from "../lib/rawgConfig";

const STORAGE_KEY = "switch-react-menu-rawg-api-key-v1";

function storage(): Storage | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function loadRawgApiKey(): string {
  const ls = storage();
  if (!ls) return "";
  try {
    const raw = ls.getItem(STORAGE_KEY);
    return typeof raw === "string" ? raw.trim() : "";
  } catch {
    return "";
  }
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

export function setRawgApiKey(key: string): void {
  const trimmed = key.trim();
  apiKeyState = trimmed;
  const ls = storage();
  if (ls) {
    try {
      if (trimmed) ls.setItem(STORAGE_KEY, trimmed);
      else ls.removeItem(STORAGE_KEY);
    } catch {
      /* quota */
    }
  }
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
