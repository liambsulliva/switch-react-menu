import { useSyncExternalStore } from "react";
import { incrementLaunchCount } from "./launchCountsStore";

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

/** Matches Save Data; updated in `recordLastPlayed` before launch. */
let persistedLastPlayedApplicationId: string | null = loadId();

/**
 * Drives the "Last Played!" UI. Initialized from storage when the menu app loads;
 * not updated by `recordLastPlayed`, so the eyebrow only moves on the next run
 * of the menu (e.g. after returning from a game).
 */
let revealedLastPlayedApplicationId: string | null = loadId();

/** Revealed id only advances when this module loads again (new process / full reload). */
export function subscribeLastPlayed(_onStoreChange: () => void): () => void {
  return () => {};
}

/** Id used for the eyebrow (lags behind `persisted` until the next app boot). */
export function getLastPlayedApplicationId(): string | null {
  return revealedLastPlayedApplicationId;
}

export function getPersistedLastPlayedApplicationId(): string | null {
  return persistedLastPlayedApplicationId;
}

/**
 * Writes the launched title to Save Data immediately, but does not refresh the
 * revealed id — the UI keeps showing the previous "last played" until this
 * process loads again.
 */
/** Counts every launch attempt and updates last-played persistence. */
export function registerAppLaunch(app: { id: bigint }): void {
  incrementLaunchCount(app.id.toString());
  recordLastPlayed(app);
}

export function recordLastPlayed(app: { id: bigint }): void {
  const id = app.id.toString();
  if (persistedLastPlayedApplicationId === id) {
    return;
  }
  persistedLastPlayedApplicationId = id;
  const ls = storage();
  if (ls) {
    try {
      ls.setItem(STORAGE_KEY, id);
    } catch {
      // best-effort persistence
    }
  }
}

export function useLastPlayedApplicationId(): string | null {
  return useSyncExternalStore(
    subscribeLastPlayed,
    getLastPlayedApplicationId,
    getLastPlayedApplicationId,
  );
}
