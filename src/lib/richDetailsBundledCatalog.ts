import {
  clearIconHeroRgbCache,
  hydrateIconHeroRgbPairCache,
  prewarmIconHeroRgbPairsForInstalledApps,
  serializeIconHeroRgbPairsForApps,
} from "./iconHeroGradientPalette";
import type { RichGameDetails } from "./richGameDetails";
import {
  loadPersistedIconHeroRgbIfSignatureMatches,
  persistIconHeroRgbByKeyIfMetaSignatureMatches,
  saveRichPersistentPayload,
  type RichPersistentPayload,
} from "./richDetailsPersistentCache";

export type RichBundledCatalogFile = {
  generatedAt?: string;
  games: RichGameDetails[];
};

const ROMFS_PATH = "romfs:/igdb-games-catalog.json";

function romfsPathToHttpUrl(romfsPath: string): string | null {
  if (!romfsPath.startsWith("romfs:/")) return null;
  return `/${romfsPath.slice("romfs:/".length)}`;
}

function canUseStreamingFetchForRomfs(): boolean {
  const doc = (
    globalThis as { document?: { createElement?: (t: string) => unknown } }
  ).document;
  return (
    typeof globalThis.fetch === "function" &&
    typeof doc?.createElement === "function"
  );
}

async function yieldToHost(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function readCatalogBytes(
  onProgress?: (ratio: number) => void,
): Promise<ArrayBuffer | null> {
  const report = (r: number) => onProgress?.(Math.max(0, Math.min(1, r)));

  const relativeUrl = romfsPathToHttpUrl(ROMFS_PATH);
  if (canUseStreamingFetchForRomfs() && relativeUrl) {
    try {
      report(0.03);
      const res = await fetch(relativeUrl);
      if (!res.ok) throw new Error(`fetch ${relativeUrl} ${res.status}`);
      const lenHeader = res.headers.get("Content-Length");
      const totalBytes = lenHeader ? Number(lenHeader) : NaN;
      const body = res.body;
      if (body) {
        const reader = body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        const cap = 0.95;
        const span = cap - 0.03;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength;
            if (Number.isFinite(totalBytes) && totalBytes > 0) {
              report(0.03 + (received / totalBytes) * span);
            } else {
              report(
                0.03 + Math.min(span, (received / (18 * 1024 * 1024)) * span),
              );
            }
          }
        }
        report(0.98);
        let sum = 0;
        for (const c of chunks) sum += c.byteLength;
        const merged = new Uint8Array(sum);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        report(1);
        return merged.buffer;
      }

      const buf = await res.arrayBuffer();
      report(1);
      return buf.byteLength ? buf : null;
    } catch {
      // Fall through to Switch.readFile (romfs / polyfill).
    }
  }

  report(0.08);
  try {
    const buf = await Switch.readFile(ROMFS_PATH);
    report(1);
    return buf && buf.byteLength > 0 ? buf : null;
  } catch {
    return null;
  }
}

type InstalledAppForCatalog = Pick<Switch.Application, "id" | "name" | "icon">;

export type InitializeRichDetailsCatalogOptions = {
  onProgress?: (ratio: number) => void;
  reuseCatalog?: boolean;
  forceRefresh?: boolean;
};

let catalogLoadPromise: Promise<RichGameDetails[]> | null = null;
let cachedBundledGames: RichGameDetails[] | null = null;
let lastCatalogGeneratedAt: string | null = null;
let installedMatchPromise: Promise<void> | null = null;
let installedMatchSignature = "";
const installedMatchesByAppId = new Map<string, RichGameDetails | null>();

const installedTitlesRevisionListeners = new Set<() => void>();
let installedTitlesRevision = 0;

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
  installedApps: Iterable<InstalledAppForCatalog>,
): string {
  return signatureForInstalledApps(Array.from(installedApps));
}

export async function ensureIconHeroRgbPairsReady(
  installedApps: readonly InstalledAppForCatalog[],
  opts: { hardReloadNonce: number; installedSignature: string },
): Promise<void> {
  if (opts.hardReloadNonce === 0) {
    const fromDisk = loadPersistedIconHeroRgbIfSignatureMatches(
      opts.installedSignature,
    );
    if (fromDisk) hydrateIconHeroRgbPairCache(fromDisk);
  }
  const withIcons = installedApps.filter(
    (a): a is InstalledAppForCatalog & { icon: ArrayBuffer } =>
      a.icon != null && a.icon.byteLength > 0,
  );
  await prewarmIconHeroRgbPairsForInstalledApps(withIcons);
  persistIconHeroRgbByKeyIfMetaSignatureMatches(
    opts.installedSignature,
    serializeIconHeroRgbPairsForApps(withIcons),
  );
}

export function resetRichDetailsSessionForHardReload(): void {
  invalidateInstalledRichMatches();
  cachedBundledGames = null;
  lastCatalogGeneratedAt = null;
  catalogLoadPromise = null;
  installedMatchesByAppId.clear();
  clearIconHeroRgbCache();
}

export function applyRichHydrationFromDisk(
  payload: RichPersistentPayload,
): void {
  if (payload.meta.schema !== 1) return;
  installedMatchesByAppId.clear();
  for (const [id, match] of Object.entries(payload.matches)) {
    installedMatchesByAppId.set(id, match);
  }
  cachedBundledGames = payload.games.length > 0 ? payload.games : null;
  lastCatalogGeneratedAt = payload.meta.catalogGeneratedAt ?? null;
  installedMatchSignature = payload.meta.installedSignature;
  installedMatchPromise = Promise.resolve();
  hydrateIconHeroRgbPairCache(payload.iconHeroRgbByKey);
}

export async function persistRichCatalogAfterBootstrap(
  installedApps: readonly InstalledAppForCatalog[],
): Promise<void> {
  const withIcons = installedApps.filter(
    (a): a is InstalledAppForCatalog & { icon: ArrayBuffer } =>
      a.icon != null && a.icon.byteLength > 0,
  );
  await saveRichPersistentPayload({
    meta: {
      schema: 1,
      installedSignature: signatureForInstalledApps(installedApps),
      catalogGeneratedAt: lastCatalogGeneratedAt,
    },
    games: cachedBundledGames ?? [],
    matches: Object.fromEntries(installedMatchesByAppId),
    iconHeroRgbByKey: serializeIconHeroRgbPairsForApps(withIcons),
  });
}

export function invalidateInstalledRichMatches(): void {
  installedMatchPromise = null;
  installedMatchSignature = "";
}

export function refreshInstalledRichMatches(
  installedApps: Iterable<InstalledAppForCatalog>,
  options?: InitializeRichDetailsCatalogOptions,
): Promise<void> {
  invalidateInstalledRichMatches();
  const reuseCatalog = options?.reuseCatalog ?? true;
  const p = initializeRichDetailsForInstalledApps(installedApps, {
    ...options,
    reuseCatalog,
    forceRefresh: true,
  });
  void p.then(() => {
    bumpInstalledTitlesRevision();
  });
  return p;
}

function parseCatalogBuffer(buf: ArrayBuffer): RichBundledCatalogFile {
  const text = new TextDecoder().decode(buf);
  const raw = JSON.parse(text) as unknown;
  if (!raw || typeof raw !== "object" || !("games" in raw)) {
    return { games: [] };
  }
  const games = (raw as { games?: unknown }).games;
  if (!Array.isArray(games)) return { games: [] };
  const out: RichGameDetails[] = [];
  for (const row of games) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name : "";
    if (!name) continue;
    const trailersRaw = r.trailers;
    const trailers: RichGameDetails["trailers"] = [];
    if (Array.isArray(trailersRaw)) {
      for (const t of trailersRaw) {
        if (!t || typeof t !== "object") continue;
        const tr = t as Record<string, unknown>;
        const youtubeId =
          typeof tr.youtubeId === "string" ? tr.youtubeId.trim() : "";
        if (!youtubeId) continue;
        trailers.push({
          name:
            typeof tr.name === "string" && tr.name.trim()
              ? tr.name.trim()
              : "Trailer",
          youtubeId,
        });
      }
    }
    const tagsRaw = r.tags;
    const tags: string[] = [];
    if (Array.isArray(tagsRaw)) {
      for (const t of tagsRaw) {
        if (typeof t === "string" && t.trim()) tags.push(t.trim());
      }
    }

    out.push({
      name,
      summary: typeof r.summary === "string" ? r.summary : null,
      firstReleaseDate:
        typeof r.firstReleaseDate === "number" ? r.firstReleaseDate : null,
      coverUrl: typeof r.coverUrl === "string" ? r.coverUrl : null,
      backgroundUrl:
        typeof r.backgroundUrl === "string" ? r.backgroundUrl : null,
      trailers,
      tags,
    });
  }
  const generatedAt = (raw as { generatedAt?: unknown }).generatedAt;
  return {
    generatedAt: typeof generatedAt === "string" ? generatedAt : undefined,
    games: out,
  };
}

async function loadBundledCatalogGames(
  onProgress?: (ratio: number) => void,
): Promise<RichGameDetails[]> {
  const emit = (r: number) => onProgress?.(Math.max(0, Math.min(1, r)));

  if (!catalogLoadPromise) {
    catalogLoadPromise = (async () => {
      try {
        const buf = await readCatalogBytes((r) => emit(r * 0.88));
        if (!buf || buf.byteLength === 0) {
          emit(1);
          cachedBundledGames = [];
          lastCatalogGeneratedAt = null;
          return [];
        }
        emit(0.94);
        const parsed = parseCatalogBuffer(buf);
        lastCatalogGeneratedAt = parsed.generatedAt ?? null;
        const games = parsed.games;
        cachedBundledGames = games;
        emit(1);
        return games;
      } catch {
        emit(1);
        return [];
      } finally {
        catalogLoadPromise = null;
      }
    })();
  }
  return catalogLoadPromise;
}

export function normalizeGameTitleForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findBundledRichMatch(
  games: readonly RichGameDetails[],
  exactByTitle: ReadonlyMap<string, RichGameDetails>,
  localTitle: string,
): RichGameDetails | null {
  const n = normalizeGameTitleForMatch(localTitle);
  if (!n) return null;

  const exact = exactByTitle.get(n);
  if (exact) return exact;

  let best: RichGameDetails | null = null;
  let bestScore = 0;

  for (const g of games) {
    const gn = normalizeGameTitleForMatch(g.name);
    if (!gn) continue;
    let score = 0;
    if (n === gn) return g;
    if (n.length >= 6 && gn.includes(n)) score = 85;
    else if (gn.length >= 6 && n.includes(gn)) score = 75;
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  }

  return bestScore >= 75 ? best : null;
}

function signatureForInstalledApps(
  apps: readonly InstalledAppForCatalog[],
): string {
  return apps.map((app) => `${app.id.toString()}:${app.name}`).join("|");
}

export function initializeRichDetailsForInstalledApps(
  installedApps: Iterable<InstalledAppForCatalog>,
  options?: InitializeRichDetailsCatalogOptions,
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
  const reuseCatalog = options?.reuseCatalog ?? false;

  installedMatchSignature = signature;
  installedMatchPromise = (async () => {
    report(0);
    let games: RichGameDetails[];
    if (reuseCatalog && cachedBundledGames !== null) {
      report(0.72);
      games = cachedBundledGames;
    } else {
      games = await loadBundledCatalogGames((r) => report(r * 0.78));
    }
    report(0.8);
    const exactByTitle = new Map<string, RichGameDetails>();
    for (const game of games) {
      const key = normalizeGameTitleForMatch(game.name);
      if (key && !exactByTitle.has(key)) exactByTitle.set(key, game);
    }

    report(0.82);
    installedMatchesByAppId.clear();
    const n = apps.length;
    for (let i = 0; i < n; i++) {
      const app = apps[i]!;
      installedMatchesByAppId.set(
        app.id.toString(),
        findBundledRichMatch(games, exactByTitle, app.name),
      );
      if (i % 6 === 5 || i === n - 1) {
        report(0.82 + 0.18 * ((i + 1) / Math.max(1, n)));
        await yieldToHost();
      }
    }
    const withIcons = apps.filter(
      (a): a is InstalledAppForCatalog & { icon: ArrayBuffer } =>
        a.icon != null && a.icon.byteLength > 0,
    );
    await prewarmIconHeroRgbPairsForInstalledApps(withIcons);
    report(1);
  })();

  return installedMatchPromise;
}

export async function getInstalledRichMatch(
  app: InstalledAppForCatalog,
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
