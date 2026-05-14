import type { IgdbGameDetails } from "./igdb";

export type IgdbBundledCatalogFile = {
  generatedAt?: string;
  games: IgdbGameDetails[];
};

let cached: Promise<IgdbBundledCatalogFile> | null = null;

const ROMFS_PATH = "romfs:/igdb-popular-games.json";

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
  return {
    generatedAt:
      typeof (raw as { generatedAt?: unknown }).generatedAt === "string"
        ? (raw as { generatedAt: string }).generatedAt
        : undefined,
    games: out,
  };
}

export function getBundledIgdbCatalog(): Promise<IgdbBundledCatalogFile> {
  if (!cached) {
    cached = (async () => {
      try {
        const buf = await Switch.readFile(ROMFS_PATH);
        if (!buf || buf.byteLength === 0) return { games: [] };
        return parseCatalogBuffer(buf);
      } catch {
        return { games: [] };
      }
    })();
  }
  return cached;
}

export function normalizeGameTitleForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findBundledIgdbMatch(
  games: readonly IgdbGameDetails[],
  localTitle: string,
): IgdbGameDetails | null {
  const n = normalizeGameTitleForMatch(localTitle);
  if (!n) return null;

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
