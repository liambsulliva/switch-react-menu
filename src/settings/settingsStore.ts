import { useSyncExternalStore } from "react";

const STORAGE_KEY = "switch-react-menu-settings";

export type SortingMode =
  | "recentlyPlayed"
  | "alphabetical"
  | "releaseDate"
  | "timesOpened"
  | "custom";

export const SORTING_MODE_SEQUENCE: SortingMode[] = [
  "recentlyPlayed",
  "alphabetical",
  "releaseDate",
  "timesOpened",
  "custom",
];

const SORTING_MODE_SET = new Set<SortingMode>(SORTING_MODE_SEQUENCE);

export function isSortingMode(value: unknown): value is SortingMode {
  return (
    typeof value === "string" && SORTING_MODE_SET.has(value as SortingMode)
  );
}

export function sortingModeLabel(mode: SortingMode): string {
  switch (mode) {
    case "recentlyPlayed":
      return "Recently Played (Stock)";
    case "alphabetical":
      return "Alphabetical";
    case "releaseDate":
      return "Release Date";
    case "timesOpened":
      return "Times Opened";
    case "custom":
      return "Custom";
    default:
      return "Recently Played (Stock)";
  }
}

// Release-date order uses the IGDB catalog; only valid while rich details are on.
export function normalizeSortingModeForRichDetails(
  sortingMode: SortingMode,
  disableRichDetails: boolean,
): SortingMode {
  if (disableRichDetails && sortingMode === "releaseDate") {
    return "recentlyPlayed";
  }
  return sortingMode;
}

export function nextSortingMode(
  current: SortingMode,
  richDetailsEnabled: boolean,
): SortingMode {
  const sequence = richDetailsEnabled
    ? SORTING_MODE_SEQUENCE
    : SORTING_MODE_SEQUENCE.filter((m) => m !== "releaseDate");
  const i = sequence.indexOf(current);
  const idx = i === -1 ? 0 : (i + 1) % sequence.length;
  return sequence[idx]!;
}

export type AppSettings = {
  disableRichDetails: boolean;
  showAppTitles: boolean;
  enableHaptics: boolean;
  showPageNumbers: boolean;
  sortingMode: SortingMode;
  compactView: boolean;
  showLastPlayed: boolean;
  enableSounds: boolean;
  screensaver: boolean;
  heroSplashInlineGrid: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  disableRichDetails: false,
  showAppTitles: true,
  enableHaptics: true,
  showPageNumbers: true,
  sortingMode: "recentlyPlayed",
  compactView: false,
  showLastPlayed: false,
  enableSounds: false,
  screensaver: true,
  heroSplashInlineGrid: false,
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
      const parsed = JSON.parse(raw) as Partial<
        AppSettings & {
          igdbInlineGridDetails?: boolean;
          alphabeticalSort?: boolean;
          customSort?: boolean;
        }
      >;
      const heroSplashInlineGrid =
        parsed.heroSplashInlineGrid ?? parsed.igdbInlineGridDetails ?? false;
      const {
        igdbInlineGridDetails: _legacyIgdb,
        alphabeticalSort: legacyAlphabetical,
        customSort: _legacyCustomSort,
        sortingMode: parsedMode,
        ...rest
      } = parsed;

      let sortingMode: SortingMode = DEFAULT_SETTINGS.sortingMode;
      if (isSortingMode(parsedMode)) {
        sortingMode = parsedMode;
      } else if (legacyAlphabetical === true) {
        sortingMode = "alphabetical";
      } else if (legacyAlphabetical === false && parsedMode === undefined) {
        sortingMode = "recentlyPlayed";
      }

      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...rest,
        heroSplashInlineGrid,
        sortingMode,
      };
      merged.sortingMode = normalizeSortingModeForRichDetails(
        merged.sortingMode,
        merged.disableRichDetails,
      );
      return merged;
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

export function setSettings(partial: Partial<AppSettings>): void {
  settingsState = { ...settingsState, ...partial };
  settingsState = {
    ...settingsState,
    sortingMode: normalizeSortingModeForRichDetails(
      settingsState.sortingMode,
      settingsState.disableRichDetails,
    ),
  };
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

export type BooleanAppSettingKey = {
  [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never;
}[keyof AppSettings];

export function toggleSetting(key: BooleanAppSettingKey): void {
  setSettings({ [key]: !settingsState[key] } as Pick<
    AppSettings,
    BooleanAppSettingKey
  >);
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
