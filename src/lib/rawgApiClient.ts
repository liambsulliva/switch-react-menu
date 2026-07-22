import type { RichGameDetails, RichTrailer } from "./richGameDetails";
import { normalizeGameTitleForMatch } from "./gameTitleMatch";
import { getRawgProxyBase, usesRawgProxy } from "./rawgConfig";

const RAWG_BASE = "https://api.rawg.io/api";
export const RAWG_SWITCH_PLATFORM_ID = 7;
const MS_BETWEEN_REQUESTS = 280;
const SEARCH_PAGE_SIZE = 5;

export class RawgApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RawgApiError";
    this.status = status;
  }
}

type RawgNamed = { id?: number; name?: string; slug?: string };

type RawgSearchGame = RawgNamed & {
  released?: string | null;
  background_image?: string | null;
  platforms?: Array<{ platform?: RawgNamed }>;
};

type RawgSearchResponse = {
  count?: number;
  results?: RawgSearchGame[];
};

type RawgGameDetails = RawgSearchGame & {
  description?: string | null;
  description_raw?: string | null;
  genres?: RawgNamed[];
  tags?: Array<RawgNamed & { language?: string }>;
  developers?: RawgNamed[];
  publishers?: RawgNamed[];
  clip?: { clip?: string; preview?: string } | null;
};

type RawgMovie = {
  id?: number;
  name?: string;
  preview?: string;
  data?: Record<string, string>;
};

type RawgMoviesResponse = {
  count?: number;
  results?: RawgMovie[];
};

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = MS_BETWEEN_REQUESTS - (now - lastRequestAt);
  if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

function buildProxyUrl(
  path: string,
  params?: Record<string, string>,
): string {
  const base = getRawgProxyBase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`, "http://localhost");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const qs = url.searchParams.toString();
  return qs ? `${base}${normalizedPath}?${qs}` : `${base}${normalizedPath}`;
}

function buildUrl(
  path: string,
  apiKey: string,
  params?: Record<string, string>,
): string {
  if (usesRawgProxy()) {
    return buildProxyUrl(path, params);
  }
  const url = new URL(`${RAWG_BASE}${path}`);
  url.searchParams.set("key", apiKey);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function rawgFetch<T>(
  path: string,
  apiKey: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  await throttle();
  const res = await fetch(buildUrl(path, apiKey, params), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new RawgApiError(
      `RAWG ${res.status}: ${text.slice(0, 160) || res.statusText}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

export { usesRawgProxy } from "./rawgConfig";

export async function validateRawgApiKey(
  apiKey: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    await rawgFetch<{ count?: number }>(
      "/platforms",
      apiKey,
      { page_size: "1" },
      signal,
    );
    return true;
  } catch (err) {
    if (err instanceof RawgApiError && err.status === 401) return false;
    throw err;
  }
}

export async function searchSwitchGames(
  title: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<RawgSearchGame[]> {
  const trimmed = title.trim();
  if (!trimmed) return [];
  const data = await rawgFetch<RawgSearchResponse>(
    "/games",
    apiKey,
    {
      search: trimmed,
      platforms: String(RAWG_SWITCH_PLATFORM_ID),
      search_precise: "true",
      page_size: String(SEARCH_PAGE_SIZE),
    },
    signal,
  );
  return Array.isArray(data.results) ? data.results : [];
}

export async function getGameDetails(
  slugOrId: string | number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<RawgGameDetails> {
  return rawgFetch<RawgGameDetails>(
    `/games/${slugOrId}`,
    apiKey,
    undefined,
    signal,
  );
}

export async function getGameMovies(
  slugOrId: string | number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<RawgMovie[]> {
  const data = await rawgFetch<RawgMoviesResponse>(
    `/games/${slugOrId}/movies`,
    apiKey,
    undefined,
    signal,
  );
  return Array.isArray(data.results) ? data.results : [];
}

function parseReleasedDate(released: string | null | undefined): number | null {
  if (!released) return null;
  const ms = Date.parse(`${released}T12:00:00`);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/,
  );
  return m?.[1] ?? null;
}

function hasSwitchPlatform(game: RawgSearchGame): boolean {
  const platforms = game.platforms;
  if (!Array.isArray(platforms)) return true;
  return platforms.some((p) => p.platform?.id === RAWG_SWITCH_PLATFORM_ID);
}

export function scoreRawgSearchCandidate(
  localTitle: string,
  candidate: RawgSearchGame,
): number {
  const localNorm = normalizeGameTitleForMatch(localTitle);
  const candidateNorm = normalizeGameTitleForMatch(candidate.name ?? "");
  if (!localNorm || !candidateNorm) return 0;
  if (localNorm === candidateNorm) return 100;
  if (!hasSwitchPlatform(candidate)) return 0;
  if (localNorm.length >= 6 && candidateNorm.includes(localNorm)) return 85;
  if (candidateNorm.length >= 6 && localNorm.includes(candidateNorm)) return 75;
  return 0;
}

export function pickBestRawgSearchResult(
  localTitle: string,
  results: readonly RawgSearchGame[],
): RawgSearchGame | null {
  let best: RawgSearchGame | null = null;
  let bestScore = 0;
  for (const candidate of results) {
    const score = scoreRawgSearchCandidate(localTitle, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore >= 75 ? best : null;
}

function buildTags(details: RawgGameDetails): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | undefined) => {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (!s) return;
    const k = s.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };

  for (const g of details.genres ?? []) push(g.name);
  for (const t of details.tags ?? []) {
    if (t.language && t.language !== "eng") continue;
    push(t.name);
  }
  for (const d of details.developers ?? []) push(d.name);
  for (const p of details.publishers ?? []) push(p.name);

  return out;
}

function trailersFromMovies(movies: readonly RawgMovie[]): RichTrailer[] {
  const out: RichTrailer[] = [];
  for (const movie of movies.slice(0, 6)) {
    const data = movie.data ?? {};
    const urls = Object.values(data).filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
    for (const url of urls) {
      const youtubeId = extractYoutubeId(url);
      if (!youtubeId) continue;
      out.push({
        name: (movie.name && movie.name.trim()) || "Trailer",
        youtubeId,
      });
      break;
    }
  }
  return out;
}

export function mapRawgDetailsToRichGameDetails(
  details: RawgGameDetails,
  movies: readonly RawgMovie[] = [],
): RichGameDetails {
  const summaryRaw =
    (typeof details.description_raw === "string" && details.description_raw) ||
    (typeof details.description === "string" && details.description) ||
    null;
  const summary = summaryRaw ? stripHtml(summaryRaw) : null;

  const trailers = trailersFromMovies(movies);

  return {
    name: typeof details.name === "string" ? details.name : "",
    summary: summary || null,
    firstReleaseDate: parseReleasedDate(details.released),
    coverUrl:
      typeof details.background_image === "string"
        ? details.background_image
        : null,
    backgroundUrl:
      typeof details.background_image === "string"
        ? details.background_image
        : null,
    trailers,
    tags: buildTags(details),
  };
}

export async function fetchRichDetailsForTitle(
  localTitle: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<RichGameDetails | null> {
  const results = await searchSwitchGames(localTitle, apiKey, signal);
  const pick = pickBestRawgSearchResult(localTitle, results);
  if (!pick) return null;

  const slug = pick.slug ?? pick.id;
  if (slug == null) return null;

  const [details, movies] = await Promise.all([
    getGameDetails(slug, apiKey, signal),
    getGameMovies(slug, apiKey, signal).catch(() => [] as RawgMovie[]),
  ]);

  const mapped = mapRawgDetailsToRichGameDetails(details, movies);
  if (!mapped.name.trim()) {
    mapped.name = localTitle;
  }
  return mapped;
}
