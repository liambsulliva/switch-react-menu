import type { IgdbGameDetails } from "./igdb";

export type IgdbBundledCatalogFile = {
  generatedAt?: string;
  games: IgdbGameDetails[];
};

const ROMFS_PATH = "romfs:/igdb-popular-games.json";

type InstalledAppForIgdb = Pick<Switch.Application, "id" | "name">;

let catalogLoadPromise: Promise<IgdbGameDetails[]> | null = null;
let installedMatchPromise: Promise<void> | null = null;
let installedMatchSignature = "";
const installedMatchesByAppId = new Map<string, IgdbGameDetails | null>();

function parseCatalogBuffer(buf: ArrayBuffer): IgdbBundledCatalogFile {
  const text = new TextDecoder().decode(buf);
  const raw = JSON.parse(text) as unknown;
  if (!raw || typeof raw !== "object" || !("games" in raw)) {
    return { games: [] };
  }
  const games = (raw as { games?: unknown }).games;
  if (!Array.isArray(games)) return { games: [] };
  const out: IgdbGameDetails[] = [];
  for (const row of games) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name : "";
    if (!name) continue;
    const trailersRaw = r.trailers;
    const trailers: IgdbGameDetails["trailers"] = [];
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
    out.push({
      name,
      summary: typeof r.summary === "string" ? r.summary : null,
      firstReleaseDate:
        typeof r.firstReleaseDate === "number" ? r.firstReleaseDate : null,
      coverUrl: typeof r.coverUrl === "string" ? r.coverUrl : null,
      trailers,
    });
  }
  const generatedAt = (raw as { generatedAt?: unknown }).generatedAt;
  return {
    generatedAt: typeof generatedAt === "string" ? generatedAt : undefined,
    games: out,
  };
}

async function loadBundledIgdbGames(): Promise<IgdbGameDetails[]> {
  if (!catalogLoadPromise) {
    catalogLoadPromise = (async () => {
      try {
        const buf = await Switch.readFile(ROMFS_PATH);
        if (!buf || buf.byteLength === 0) return [];
        return parseCatalogBuffer(buf).games;
      } catch {
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

function findBundledIgdbMatch(
  games: readonly IgdbGameDetails[],
  exactByTitle: ReadonlyMap<string, IgdbGameDetails>,
  localTitle: string,
): IgdbGameDetails | null {
  const n = normalizeGameTitleForMatch(localTitle);
  if (!n) return null;

  const exact = exactByTitle.get(n);
  if (exact) return exact;

  let best: IgdbGameDetails | null = null;
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

function signatureForInstalledApps(apps: readonly InstalledAppForIgdb[]): string {
  return apps.map((app) => `${app.id.toString()}:${app.name}`).join("|");
}

export function initializeInstalledIgdbMatches(
  installedApps: Iterable<InstalledAppForIgdb>,
): Promise<void> {
  const apps = Array.from(installedApps);
  const signature = signatureForInstalledApps(apps);

  if (installedMatchPromise && installedMatchSignature === signature) {
    return installedMatchPromise;
  }

  installedMatchSignature = signature;
  installedMatchPromise = (async () => {
    const games = await loadBundledIgdbGames();
    const exactByTitle = new Map<string, IgdbGameDetails>();
    for (const game of games) {
      const key = normalizeGameTitleForMatch(game.name);
      if (key && !exactByTitle.has(key)) exactByTitle.set(key, game);
    }

    installedMatchesByAppId.clear();
    for (const app of apps) {
      installedMatchesByAppId.set(
        app.id.toString(),
        findBundledIgdbMatch(games, exactByTitle, app.name),
      );
    }
  })();

  return installedMatchPromise;
}

export async function getInstalledIgdbMatch(
  app: InstalledAppForIgdb,
): Promise<IgdbGameDetails | null> {
  if (!installedMatchPromise) {
    await initializeInstalledIgdbMatches([app]);
  } else {
    await installedMatchPromise;
  }
  return installedMatchesByAppId.get(app.id.toString()) ?? null;
}
