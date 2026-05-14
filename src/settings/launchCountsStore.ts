import { useSyncExternalStore } from "react";

const STORAGE_KEY = "switch-react-menu-launch-counts";

function storage(): Storage | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function loadCounts(): Record<string, number> {
  const ls = storage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        out[k] = Math.floor(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

let counts: Record<string, number> = loadCounts();
let revision = 0;
const listeners = new Set<() => void>();

function emit() {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function getLaunchCountsRevision(): number {
  return revision;
}

export function subscribeLaunchCounts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLaunchCountsRevision(): number {
  return useSyncExternalStore(
    subscribeLaunchCounts,
    getLaunchCountsRevision,
    getLaunchCountsRevision,
  );
}

export function getLaunchCount(applicationId: string): number {
  return counts[applicationId] ?? 0;
}

export function incrementLaunchCount(applicationId: string): void {
  const next = (counts[applicationId] ?? 0) + 1;
  counts = { ...counts, [applicationId]: next };
  const ls = storage();
  if (ls) {
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(counts));
    } catch {
      // best-effort
    }
  }
  emit();
}
