import { useSyncExternalStore } from "react";

const STORAGE_KEY = "switch-react-menu-settings";

export type AppSettings = {
  showAppTitles: boolean;
  enableHaptics: boolean;
  showPageNumbers: boolean;
  alphabeticalSort: boolean;
  compactView: boolean;
  showLastPlayed: boolean;
  enableSounds: boolean;
  screensaver: boolean;
  customSort: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  showAppTitles: true,
  enableHaptics: true,
  showPageNumbers: true,
  alphabeticalSort: false,
  compactView: false,
  showLastPlayed: false,
  enableSounds: false,
  screensaver: true,
  customSort: false,
};

function storage(): Storage | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function loadSettings(): AppSettings {
  const ls = storage();
  if (!ls) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore corrupt save data
  }
  return { ...DEFAULT_SETTINGS };
}

let settingsState: AppSettings = loadSettings();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getSettings(): AppSettings {
  return settingsState;
}

/** Merge partial settings, persist to Save Data via nx.js `localStorage`, notify subscribers. */
export function setSettings(partial: Partial<AppSettings>): void {
  settingsState = { ...settingsState, ...partial };
  const ls = storage();
  if (ls) {
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(settingsState));
    } catch {
      // best-effort persistence
    }
  }
  emit();
}

export function toggleSetting(key: keyof AppSettings): void {
  setSettings({ [key]: !settingsState[key] } as Partial<AppSettings>);
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
