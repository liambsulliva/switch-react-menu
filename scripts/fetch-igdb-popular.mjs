import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "igdb-popular-games.json");

/** IGDB platform id for “Nintendo Switch” (not Switch 2). */
const NINTENDO_SWITCH_PLATFORM_ID = 130;
const GAMES_PAGE_LIMIT = 500;
const VIDEO_CHUNK = 400;
const MS_BETWEEN_REQUESTS = 260;

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
const IGDB_GAME_VIDEOS_URL = "https://api.igdb.com/v4/game_videos";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, "utf8");
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function clientId() {
  return (
    process.env.VITE_IGDB_CLIENT_ID ||
    process.env.IGDB_CLIENT_ID ||
    ""
  ).trim();
}

function clientSecret() {
  return (
    process.env.VITE_IGDB_CLIENT_SECRET ||
    process.env.IGDB_CLIENT_SECRET ||
    ""
  ).trim();
}

function coverUrl(imageId) {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

function backgroundUrl(game) {
  const imageId =
    game?.screenshots?.[0]?.image_id ?? game?.artworks?.[0]?.image_id ?? null;
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_screenshot_huge/${imageId}.jpg`;
}

async function twitchToken(id, secret) {
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    grant_type: "client_credentials",
  });
  const res = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Twitch OAuth ${res.status}`);
  const json = await res.json();
  if (!json.access_token) throw new Error("Twitch OAuth: missing access_token");
  return json.access_token;
}

async function igdbPost(url, id, token, apicalypse) {
  await sleep(MS_BETWEEN_REQUESTS);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": id,
      Authorization: `Bearer ${token}`,
    },
    body: apicalypse,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`IGDB ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllSwitchGames(clientId, token) {
  const seen = new Set();
  const games = [];
  let offset = 0;

  while (true) {
    const body = [
      [
        "fields name,summary,first_release_date,cover.image_id",
        "screenshots.image_id,artworks.image_id,videos,id;",
      ].join(","),
      `where platforms = (${NINTENDO_SWITCH_PLATFORM_ID}) & version_parent = null;`,
      "sort total_rating_count desc;",
      `limit ${GAMES_PAGE_LIMIT};`,
      `offset ${offset};`,
    ].join("\n");

    const page = await igdbPost(IGDB_GAMES_URL, clientId, token, body);
    if (!Array.isArray(page)) throw new Error("IGDB games: expected array");
    if (page.length === 0) break;

    for (const g of page) {
      const gid = g?.id;
      if (typeof gid !== "number" || seen.has(gid)) continue;
      seen.add(gid);
      games.push(g);
    }

    if (page.length < GAMES_PAGE_LIMIT) break;
    offset += page.length;
  }

  return games;
}

function collectVideoIds(games) {
  const ids = new Set();
  for (const g of games) {
    const v = g.videos;
    if (!Array.isArray(v)) continue;
    for (const x of v) {
      if (typeof x === "number") ids.add(x);
    }
  }
  return [...ids];
}

async function fetchVideoRows(clientId, token, ids) {
  const map = new Map();
  for (let i = 0; i < ids.length; i += VIDEO_CHUNK) {
    const slice = ids.slice(i, i + VIDEO_CHUNK);
    if (slice.length === 0) continue;
    const body = `where id = (${slice.join(",")}); fields video_id,name; limit ${slice.length};`;
    const rows = await igdbPost(IGDB_GAME_VIDEOS_URL, clientId, token, body);
    for (const row of rows) {
      if (typeof row.id === "number") map.set(row.id, row);
    }
  }
  return map;
}

function trailersForGame(videos, videoById) {
  if (!Array.isArray(videos) || videos.length === 0) return [];
  const out = [];
  if (typeof videos[0] === "number") {
    for (const id of videos.slice(0, 8)) {
      const row = videoById.get(id);
      const yid = row?.video_id?.trim();
      if (yid)
        out.push({
          name: (row.name && String(row.name).trim()) || "Trailer",
          youtubeId: yid,
        });
    }
    return out;
  }
  if (typeof videos[0] === "object" && videos[0]?.video_id) {
    for (const v of videos) {
      const yid = v.video_id?.trim();
      if (yid)
        out.push({
          name: (v.name && String(v.name).trim()) || "Trailer",
          youtubeId: yid,
        });
    }
  }
  return out;
}

async function main() {
  loadDotEnv();
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) {
    console.error(
      "Missing credentials. Set VITE_IGDB_CLIENT_ID and VITE_IGDB_CLIENT_SECRET in .env",
    );
    process.exit(1);
  }

  const token = await twitchToken(id, secret);

  const games = await fetchAllSwitchGames(id, token);
  if (games.length === 0) {
    throw new Error(
      "No Nintendo Switch games returned from IGDB (check credentials / query).",
    );
  }

  const vidIds = collectVideoIds(games);
  const videoById =
    vidIds.length > 0 ? await fetchVideoRows(id, token, vidIds) : new Map();

  const outGames = [];
  for (const g of games) {
    if (!g?.name) continue;
    outGames.push({
      name: g.name,
      summary: g.summary ?? null,
      firstReleaseDate:
        typeof g.first_release_date === "number" ? g.first_release_date : null,
      coverUrl: coverUrl(g.cover?.image_id),
      backgroundUrl: backgroundUrl(g),
      trailers: trailersForGame(g.videos, videoById),
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    games: outGames,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log(
    `Wrote ${outGames.length} Nintendo Switch games (platform ${NINTENDO_SWITCH_PLATFORM_ID}) to ${OUT}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
