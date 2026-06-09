import {
  clearIconHeroRgbCache,
  hydrateIconHeroRgbPairCache,
  prewarmIconHeroRgbPairsForInstalledApps,
  serializeIconHeroRgbPairsForApps,
} from "./iconHeroGradientPalette";
export { normalizeGameTitleForMatch } from "./gameTitleMatch";
import type { RichGameDetails } from "./richGameDetails";
import {
  fetchRichDetailsForTitle,
  RawgApiError,
} from "./rawgApiClient";
import { getRawgApiKey } from "../settings/rawgApiKeyStore";
import {
  loadPersistedIconHeroRgbIfSignatureMatches,
  loadPersistedManualOverrides,
  loadRichPersistentPayload,
  persistIconHeroRgbByKeyIfMetaSignatureMatches,
  RICH_CACHE_PROVIDER,
  RICH_CACHE_SCHEMA,
  saveRichPersistentPayload,
  type RichPersistentPayload,
} from "./richDetailsPersistentCache";

type InstalledAppForRichDetails = Pick<Switch.Application, "id" | "name" | "icon">;

export type InitializeRichDetailsOptions = {
  onProgress?: (ratio: number) => void;
  forceRefresh?: boolean;
};

let installedMatchPromise: Promise<void> | null = null;
let installedMatchSignature = "";
let lastFetchedAt: string | null = null;
const installedMatchesByAppId = new Map<string, RichGameDetails | null>();
const manualOverridesByAppId = new Set<string>();

const installedTitlesRevisionListeners = new Set<() => void>();
let installedTitlesRevision = 0;

async function yieldToHost(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function bumpInstalledTitlesRevision(): void {
  installedTitlesRevision += 1;
  for (const listener of installedTitlesRevisionListeners) {
    listener();
  }
}

export function subscribeInstalledTitlesRevision(
  listener: () => void,
): () => void {
  installedTitlesRevisionListeners.add(listener);
  return () => {
    installedTitlesRevisionListeners.delete(listener);
  };
}

export function getInstalledTitlesRevision(): number {
  return installedTitlesRevision;
}

export function getInstalledAppSignature(
  installedApps: Iterable<InstalledAppForRichDetails>,
): string {
  return signatureForInstalledApps(Array.from(installedApps));
}

export async function ensureIconHeroRgbPairsReady(
  installedApps: readonly InstalledAppForRichDetails[],
  opts: { hardReloadNonce: number; installedSignature: string },
): Promise<void> {
  if (opts.hardReloadNonce === 0) {
    const fromDisk = loadPersistedIconHeroRgbIfSignatureMatches(
      opts.installedSignature,
    );
    if (fromDisk) hydrateIconHeroRgbPairCache(fromDisk);
  }
  const withIcons = installedApps.filter(
    (a): a is InstalledAppForRichDetails & { icon: ArrayBuffer } =>
      a.icon != null && a.icon.byteLength > 0,
  );
  await prewarmIconHeroRgbPairsForInstalledApps(withIcons);
  persistIconHeroRgbByKeyIfMetaSignatureMatches(
    opts.installedSignature,
    serializeIconHeroRgbPairsForApps(withIcons),
  );
}

export function resetRichDetailsSessionForHardReload(opts?: {
  preserveManual?: boolean;
}): void {
  const preservedManual = new Set<string>();
  const preservedMatches = new Map<string, RichGameDetails | null>();
  if (opts?.preserveManual) {
    for (const id of manualOverridesByAppId) {
      preservedManual.add(id);
      preservedMatches.set(id, installedMatchesByAppId.get(id) ?? null);
    }
  }

  invalidateInstalledRichMatches();
  lastFetchedAt = null;
  installedMatchesByAppId.clear();
  manualOverridesByAppId.clear();
  clearIconHeroRgbCache();

  if (opts?.preserveManual) {
    for (const id of preservedManual) manualOverridesByAppId.add(id);
    for (const [id, match] of preservedMatches) {
      installedMatchesByAppId.set(id, match);
    }
  }
}

export function applyRichHydrationFromDisk(
  payload: RichPersistentPayload,
): void {
  if (payload.meta.schema !== RICH_CACHE_SCHEMA) return;
  installedMatchesByAppId.clear();
  manualOverridesByAppId.clear();
  for (const [id, match] of Object.entries(payload.matches)) {
    installedMatchesByAppId.set(id, match);
  }
  for (const [id, manual] of Object.entries(payload.manualOverrides ?? {})) {
    if (manual) manualOverridesByAppId.add(id);
  }
  lastFetchedAt = payload.meta.lastFetchedAt ?? null;
  installedMatchSignature = payload.meta.installedSignature;
  installedMatchPromise = Promise.resolve();
  hydrateIconHeroRgbPairCache(payload.iconHeroRgbByKey ?? {});
}

export async function persistRichDetailsAfterBootstrap(
  installedApps: readonly InstalledAppForRichDetails[],
): Promise<void> {
  const withIcons = installedApps.filter(
    (a): a is InstalledAppForRichDetails & { icon: ArrayBuffer } =>
      a.icon != null && a.icon.byteLength > 0,
  );
  const manualOverrides: Record<string, boolean> = {};
  for (const id of manualOverridesByAppId) {
    manualOverrides[id] = true;
  }
  await saveRichPersistentPayload({
    meta: {
      schema: RICH_CACHE_SCHEMA,
      installedSignature: signatureForInstalledApps(installedApps),
      lastFetchedAt,
      provider: RICH_CACHE_PROVIDER,
    },
    matches: Object.fromEntries(installedMatchesByAppId),
    manualOverrides,
    iconHeroRgbByKey: serializeIconHeroRgbPairsForApps(withIcons),
  });
}

export function invalidateInstalledRichMatches(): void {
  installedMatchPromise = null;
  installedMatchSignature = "";
}

export function refreshInstalledRichMatches(
  installedApps: Iterable<InstalledAppForRichDetails>,
  options?: InitializeRichDetailsOptions,
): Promise<void> {
  invalidateInstalledRichMatches();
  const p = initializeRichDetailsForInstalledApps(installedApps, {
    ...options,
    forceRefresh: true,
  });
  void p.then(() => {
    bumpInstalledTitlesRevision();
  });
  return p;
}

function signatureForInstalledApps(
  apps: readonly InstalledAppForRichDetails[],
): string {
  return apps.map((app) => `${app.id.toString()}:${app.name}`).join("|");
}

export function markInstalledRichMatchManual(applicationId: string): void {
  manualOverridesByAppId.add(applicationId);
}

export function isInstalledRichMatchManual(applicationId: string): boolean {
  return manualOverridesByAppId.has(applicationId);
}

export function initializeRichDetailsForInstalledApps(
  installedApps: Iterable<InstalledAppForRichDetails>,
  options?: InitializeRichDetailsOptions,
): Promise<void> {
  const apps = Array.from(installedApps);
  const signature = signatureForInstalledApps(apps);

  if (
    !options?.forceRefresh &&
    installedMatchPromise &&
    installedMatchSignature === signature
  ) {
    options?.onProgress?.(1);
    return installedMatchPromise;
  }

  const onProgress = options?.onProgress;
  const report = (r: number) => onProgress?.(Math.max(0, Math.min(1, r)));
  const forceRefresh = options?.forceRefresh ?? false;
  const apiKey = getRawgApiKey();

  installedMatchSignature = signature;
  installedMatchPromise = (async () => {
    report(0);

    const persistedManual = loadPersistedManualOverrides(signature);
    for (const [id, manual] of Object.entries(persistedManual)) {
      if (manual) manualOverridesByAppId.add(id);
    }

    if (forceRefresh) {
      const payload = await loadRichPersistentPayload(signature);
      if (payload) {
        for (const [id, manual] of Object.entries(payload.manualOverrides ?? {})) {
          if (!manual) continue;
          manualOverridesByAppId.add(id);
          if (!installedMatchesByAppId.has(id)) {
            installedMatchesByAppId.set(id, payload.matches[id] ?? null);
          }
        }
      }
      for (const app of apps) {
        const id = app.id.toString();
        if (!manualOverridesByAppId.has(id)) {
          installedMatchesByAppId.delete(id);
        }
      }
    }

    const n = apps.length;
    let completed = 0;

    for (let i = 0; i < n; i++) {
      const app = apps[i]!;
      const appId = app.id.toString();

      const cached = installedMatchesByAppId.get(appId);
      const isManual = manualOverridesByAppId.has(appId);
      const needsFetch =
        !!apiKey &&
        !isManual &&
        (forceRefresh || cached === undefined);

      if (needsFetch) {
        try {
          const details = await fetchRichDetailsForTitle(app.name, apiKey);
          installedMatchesByAppId.set(appId, details);
        } catch (err) {
          if (err instanceof RawgApiError && err.status === 401) {
            installedMatchesByAppId.set(appId, cached ?? null);
            throw err;
          }
          installedMatchesByAppId.set(appId, cached ?? null);
        }
      } else if (cached === undefined) {
        installedMatchesByAppId.set(appId, null);
      }

      completed += 1;
      report(0.08 + (0.82 * completed) / Math.max(1, n));
      if (i % 2 === 1 || i === n - 1) {
        await yieldToHost();
      }
    }

    const withIcons = apps.filter(
      (a): a is InstalledAppForRichDetails & { icon: ArrayBuffer } =>
        a.icon != null && a.icon.byteLength > 0,
    );
    report(0.94);
    await prewarmIconHeroRgbPairsForInstalledApps(withIcons);
    lastFetchedAt = new Date().toISOString();
    report(1);
  })();

  return installedMatchPromise;
}

export async function getInstalledRichMatch(
  app: InstalledAppForRichDetails,
): Promise<RichGameDetails | null> {
  if (!installedMatchPromise) {
    await initializeRichDetailsForInstalledApps([app]);
  } else {
    await installedMatchPromise;
  }
  return installedMatchesByAppId.get(app.id.toString()) ?? null;
}

export function peekInstalledRichMatch(
  applicationId: string,
): RichGameDetails | null {
  return installedMatchesByAppId.get(applicationId) ?? null;
}

export function setInstalledRichMatch(
  applicationId: string,
  details: RichGameDetails | null,
): void {
  installedMatchesByAppId.set(applicationId, details);
  bumpInstalledTitlesRevision();
}
