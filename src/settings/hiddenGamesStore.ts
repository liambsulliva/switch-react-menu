import { useSyncExternalStore, useMemo } from "react";

const STORAGE_KEY = "switch-react-menu-hidden-games";

function loadHidden(): string[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as string[];
    }
  } catch {
    // ignore corrupt data
  }
  return [];
}

let hiddenState: string[] = loadHidden();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((id) => bs.has(id));
}

function setHiddenGameIds(ids: string[]): void {
  const next = [...new Set(ids)];
  if (sameIdSet(hiddenState, next)) return;
  hiddenState = next;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenState));
    }
  } catch {
    // throw nothing
  }
  emit();
}

export function toggleHiddenGameId(id: string): void {
  const set = new Set(hiddenState);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  setHiddenGameIds(Array.from(set));
}

export function subscribeHiddenGames(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string[] {
  return hiddenState;
}

function useHiddenGameIds(): string[] {
  return useSyncExternalStore(
    subscribeHiddenGames,
    getSnapshot,
    getSnapshot,
  );
}

export function useHiddenGameIdSet(): Set<string> {
  const ids = useHiddenGameIds();
  return useMemo(() => new Set(ids), [ids]);
}
