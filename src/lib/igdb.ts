const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
const IGDB_GAME_VIDEOS_URL = "https://api.igdb.com/v4/game_videos";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

export type IgdbTrailer = {
  name: string;
  youtubeId: string;
};

export type IgdbGameDetails = {
  name: string;
  summary: string | null;
  firstReleaseDate: number | null;
  coverUrl: string | null;
  trailers: IgdbTrailer[];
};

export type IgdbAuthHeaders = {
  clientId: string;
  authorization: string;
};

function readViteEnv(key: string): string | undefined {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> })
      .env;
    const v = env?.[key];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

function readIgdbClientSecret(): string | undefined {
  return (
    readViteEnv("VITE_IGDB_CLIENT_SECRET") ?? readViteEnv("IGDB_CLIENT_SECRET")
  );
}

let cachedAccessToken: string | null = null;
let cachedTokenExpiryMs = 0;

async function fetchTwitchAppAccessToken(
  clientId: string,
  clientSecret: string,
  signal?: AbortSignal,
): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedTokenExpiryMs - 45_000) {
    return cachedAccessToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal,
  });

  if (!res.ok) {
    throw new Error(`Twitch OAuth ${res.status}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  const token = json.access_token;
  if (!token) {
    throw new Error("Twitch OAuth: missing access_token");
  }

  const ttlSec = typeof json.expires_in === "number" ? json.expires_in : 3600;
  cachedAccessToken = token;
  cachedTokenExpiryMs = Date.now() + ttlSec * 1000;
  return token;
}

/** True when Client ID and Client Secret are configured (Twitch app password). */
export function hasIgdbClientConfig(): boolean {
  const clientId = readViteEnv("VITE_IGDB_CLIENT_ID");
  const clientSecret = readIgdbClientSecret();
  return Boolean(clientId && clientSecret);
}

export async function getIgdbAuthHeaders(
  signal?: AbortSignal,
): Promise<IgdbAuthHeaders | null> {
  const clientId = readViteEnv("VITE_IGDB_CLIENT_ID");
  const clientSecret = readIgdbClientSecret();
  if (!clientId || !clientSecret) return null;
  const accessToken = await fetchTwitchAppAccessToken(
    clientId,
    clientSecret,
    signal,
  );
  return { clientId, authorization: `Bearer ${accessToken}` };
}

function igdbCoverUrl(imageId: string | undefined): string | null {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

function escapeSearch(q: string): string {
  return q
    .replace(/\\/g, " ")
    .replace(/"/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type IgdbGameResponse = {
  id?: number;
  name?: string;
  summary?: string;
  first_release_date?: number;
  cover?: { image_id?: string } | null;
  videos?: unknown;
};

type IgdbGameVideoRow = {
  video_id?: string;
  name?: string;
};

function trailersFromVideoObjects(
  raw: unknown,
): IgdbTrailer[] | "need_ids" {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0];
  if (typeof first === "number") return "need_ids";
  if (typeof first === "object" && first !== null && "video_id" in first) {
    const out: IgdbTrailer[] = [];
    for (const v of raw as IgdbGameVideoRow[]) {
      const id = v.video_id?.trim();
      if (id) {
        out.push({
          name: (v.name && v.name.trim()) || "Trailer",
          youtubeId: id,
        });
      }
    }
    return out;
  }
  return [];
}

function videoIdsFromGame(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is number => typeof x === "number");
}

async function fetchGameVideosByIds(
  ids: number[],
  headers: IgdbAuthHeaders,
  signal?: AbortSignal,
): Promise<IgdbTrailer[]> {
  const unique = [...new Set(ids)].slice(0, 8);
  if (unique.length === 0) return [];
  const body = `where id = (${unique.join(",")}); fields video_id,name; limit ${unique.length};`;
  const res = await fetch(IGDB_GAME_VIDEOS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": headers.clientId,
      Authorization: headers.authorization,
    },
    body,
    signal,
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as IgdbGameVideoRow[];
  const out: IgdbTrailer[] = [];
  for (const v of rows) {
    const id = v.video_id?.trim();
    if (id) {
      out.push({
        name: (v.name && v.name.trim()) || "Trailer",
        youtubeId: id,
      });
    }
  }
  return out;
}

export async function fetchIgdbGameByName(
  name: string,
  signal?: AbortSignal,
): Promise<IgdbGameDetails | null> {
  const headers = await getIgdbAuthHeaders(signal);
  if (!headers) return null;

  const q = escapeSearch(name);
  if (!q) return null;

  const body = [
    `search "${q}";`,
    "fields name,summary,first_release_date,cover.image_id,videos;",
    "limit 1;",
  ].join(" ");

  const res = await fetch(IGDB_GAMES_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": headers.clientId,
      Authorization: headers.authorization,
    },
    body,
    signal,
  });

  if (!res.ok) {
    throw new Error(`IGDB ${res.status}`);
  }

  const json = (await res.json()) as IgdbGameResponse[];
  const game = json[0];
  if (!game?.name) return null;

  let trailers: IgdbTrailer[] = trailersFromVideoObjects(game.videos);
  if (trailers === "need_ids") {
    const ids = videoIdsFromGame(game.videos);
    trailers = await fetchGameVideosByIds(ids, headers, signal);
  }

  return {
    name: game.name,
    summary: game.summary ?? null,
    firstReleaseDate:
      typeof game.first_release_date === "number"
        ? game.first_release_date
        : null,
    coverUrl: igdbCoverUrl(game.cover?.image_id),
    trailers,
  };
}

export function formatIgdbReleaseDate(ts: number | null): string {
  if (ts == null) return "";
  try {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
