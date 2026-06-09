/// <reference lib="dom" />
import type { IconHeroRgbPair } from "./iconHeroGradientPalette";
import type { RichGameDetails } from "./richGameDetails";

export const RICH_CACHE_SCHEMA = 2;
export const RICH_CACHE_PROVIDER = "rawg";

const LS_META_KEY = "switch-react-menu-rich-cache-meta-v2";
const LS_MATCHES_KEY = "switch-react-menu-rich-cache-matches-v2";
const LS_MANUAL_KEY = "switch-react-menu-rich-cache-manual-v2";
const LS_ICON_HERO_KEY = "switch-react-menu-rich-cache-icon-hero-v2";

const LEGACY_LS_META_KEY = "switch-react-menu-rich-cache-meta-v1";
const LEGACY_LS_MATCHES_KEY = "switch-react-menu-rich-cache-matches-v1";
const LEGACY_LS_MANUAL_KEY = "switch-react-menu-rich-cache-manual-v1";
const LEGACY_LS_ICON_HERO_KEY = "switch-react-menu-rich-cache-icon-hero-v1";
const LEGACY_IDB_NAME = "switch-react-menu-rich";

export type RichPersistentMeta = {
  schema: number;
  installedSignature: string;
  lastFetchedAt: string | null;
  provider?: string;
};

export type RichPersistentPayload = {
  meta: RichPersistentMeta;
  matches: Record<string, RichGameDetails | null>;
  manualOverrides?: Record<string, boolean>;
  iconHeroRgbByKey?: Record<string, IconHeroRgbPair>;
};

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function deleteLegacyIndexedDb(): void {
  if (!hasIndexedDB()) return;
  void new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(LEGACY_IDB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function migrateLegacyLocalStorageKeys(): void {
  if (typeof localStorage === "undefined") return;
  const pairs: Array<[string, string]> = [
    [LEGACY_LS_META_KEY, LS_META_KEY],
    [LEGACY_LS_MATCHES_KEY, LS_MATCHES_KEY],
    [LEGACY_LS_MANUAL_KEY, LS_MANUAL_KEY],
    [LEGACY_LS_ICON_HERO_KEY, LS_ICON_HERO_KEY],
  ];
  for (const [legacy, next] of pairs) {
    try {
      const value = localStorage.getItem(legacy);
      if (value != null && localStorage.getItem(next) == null) {
        localStorage.setItem(next, value);
      }
      localStorage.removeItem(legacy);
    } catch {
      /* ignore */
    }
  }
  deleteLegacyIndexedDb();
}

let legacyMigrationDone = false;

function ensureLegacyMigration(): void {
  if (legacyMigrationDone) return;
  legacyMigrationDone = true;
  migrateLegacyLocalStorageKeys();
}

function readLsMeta(): RichPersistentMeta | null {
  ensureLegacyMigration();
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RichPersistentMeta> &
      Record<string, unknown>;
    if (parsed.schema !== RICH_CACHE_SCHEMA) return null;
    if (typeof parsed.installedSignature !== "string") return null;
    const legacyFetchedAt = parsed["catalogGeneratedAt"];
    const lastFetchedAt =
      typeof parsed.lastFetchedAt === "string" || parsed.lastFetchedAt === null
        ? parsed.lastFetchedAt
        : typeof legacyFetchedAt === "string" || legacyFetchedAt === null
          ? (legacyFetchedAt as string | null)
          : null;
    return {
      schema: RICH_CACHE_SCHEMA,
      installedSignature: parsed.installedSignature,
      lastFetchedAt,
      provider:
        typeof parsed.provider === "string" ? parsed.provider : undefined,
    };
  } catch {
    return null;
  }
}

function writeLsMeta(meta: RichPersistentMeta): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
  } catch {
    /* quota or disabled */
  }
}

function readLsMatches(): Record<string, RichGameDetails | null> | null {
  ensureLegacyMigration();
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_MATCHES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, RichGameDetails | null>;
  } catch {
    return null;
  }
}

function writeLsMatches(matches: Record<string, RichGameDetails | null>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_MATCHES_KEY, JSON.stringify(matches));
  } catch {
    /* quota */
  }
}

function readLsManualOverrides(): Record<string, boolean> {
  ensureLegacyMigration();
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_MANUAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeLsManualOverrides(manualOverrides: Record<string, boolean>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_MANUAL_KEY, JSON.stringify(manualOverrides));
  } catch {
    /* quota */
  }
}

function readLsIconHeroRgbByKey(): Record<string, IconHeroRgbPair> | null {
  ensureLegacyMigration();
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_ICON_HERO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, IconHeroRgbPair>;
  } catch {
    return null;
  }
}

function writeLsIconHeroRgbByKey(
  iconHeroRgbByKey: Record<string, IconHeroRgbPair>,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_ICON_HERO_KEY, JSON.stringify(iconHeroRgbByKey));
  } catch {
    /* quota */
  }
}

export function clearRichPersistentCache(): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(LS_META_KEY);
      localStorage.removeItem(LS_MATCHES_KEY);
      localStorage.removeItem(LS_MANUAL_KEY);
      localStorage.removeItem(LS_ICON_HERO_KEY);
      localStorage.removeItem(LEGACY_LS_META_KEY);
      localStorage.removeItem(LEGACY_LS_MATCHES_KEY);
      localStorage.removeItem(LEGACY_LS_MANUAL_KEY);
      localStorage.removeItem(LEGACY_LS_ICON_HERO_KEY);
    } catch {
      /* ignore */
    }
  }
  deleteLegacyIndexedDb();
}

export async function loadRichPersistentPayload(
  currentInstalledSignature: string,
): Promise<RichPersistentPayload | null> {
  const meta = readLsMeta();
  if (!meta || meta.installedSignature !== currentInstalledSignature) {
    return null;
  }
  if (meta.provider && meta.provider !== RICH_CACHE_PROVIDER) {
    return null;
  }

  const matches = readLsMatches();
  if (!matches) return null;

  const iconHeroRgbByKey = readLsIconHeroRgbByKey() ?? undefined;
  const manualOverrides = readLsManualOverrides();

  return { meta, matches, manualOverrides, iconHeroRgbByKey };
}

export async function saveRichPersistentPayload(
  payload: RichPersistentPayload,
): Promise<void> {
  writeLsMeta({
    ...payload.meta,
    schema: RICH_CACHE_SCHEMA,
    provider: RICH_CACHE_PROVIDER,
    lastFetchedAt: payload.meta.lastFetchedAt,
  });
  writeLsMatches(payload.matches);
  if (payload.manualOverrides) {
    writeLsManualOverrides(payload.manualOverrides);
  }
  if (payload.iconHeroRgbByKey && Object.keys(payload.iconHeroRgbByKey).length > 0) {
    writeLsIconHeroRgbByKey(payload.iconHeroRgbByKey);
  }
}

export function loadPersistedIconHeroRgbIfSignatureMatches(
  installedSignature: string,
): Record<string, IconHeroRgbPair> | null {
  const meta = readLsMeta();
  if (!meta || meta.installedSignature !== installedSignature) return null;
  return readLsIconHeroRgbByKey();
}

export function persistIconHeroRgbByKeyIfMetaSignatureMatches(
  installedSignature: string,
  iconHeroRgbByKey: Record<string, IconHeroRgbPair>,
): void {
  const meta = readLsMeta();
  if (!meta || meta.installedSignature !== installedSignature) return;
  if (Object.keys(iconHeroRgbByKey).length === 0) return;
  writeLsIconHeroRgbByKey(iconHeroRgbByKey);
}

export function loadPersistedManualOverrides(
  installedSignature: string,
): Record<string, boolean> {
  const meta = readLsMeta();
  if (!meta || meta.installedSignature !== installedSignature) return {};
  return readLsManualOverrides();
}
