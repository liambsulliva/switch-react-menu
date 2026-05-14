import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "igdb-games-catalog.json");

/** IGDB platform id for “Nintendo Switch” (not Switch 2). */
const NINTENDO_SWITCH_PLATFORM_ID = 130;
const GAMES_PAGE_LIMIT = 500;
const VIDEO_CHUNK = 400;
const MS_BETWEEN_REQUESTS = 260;
const BAR_WIDTH = 36;
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
const IGDB_GAME_VIDEOS_URL = "https://api.igdb.com/v4/game_videos";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Asymptotic 0..1 from page count when total pages is unknown (IGDB pagination). */
function asymptoticPagesT(pagesDone) {
  if (pagesDone <= 0) return 0;
  return 1 - 0.82 ** pagesDone;
}

class CliProgress {
  constructor() {
    this.tty = Boolean(process.stdout.isTTY);
    this.started = false;
    this.lastPrintedPct = -1;
    this.lastStatus = "";
  }

  /**
   * @param {number} pct 0–100
   * @param {string} [status]
   */
  update(pct, status = "") {
    const p = Math.max(0, Math.min(100, pct));
    const label = status || this.lastStatus;
    if (label) this.lastStatus = label;

    if (this.tty) {
      const filled = Math.round((BAR_WIDTH * p) / 100);
      const empty = BAR_WIDTH - filled;
      const barCore = `\x1b[96m${"█".repeat(filled)}\x1b[90m${"░".repeat(empty)}\x1b[0m`;
      const line1 = `  \x1b[1m\x1b[97m▌\x1b[0m${barCore}\x1b[1m\x1b[97m▐\x1b[0m`;
      const pctStr = p.toFixed(1).padStart(5, " ");
      const line2 = `  \x1b[90m${pctStr}%\x1b[0m complete${label ? `  \x1b[2m·\x1b[0m ${label}` : ""}`;

      if (!this.started) {
        process.stdout.write(`${line1}\n${line2}\n`);
        this.started = true;
      } else {
        process.stdout.write(`\x1b[2A\r\x1b[2K${line1}\n\x1b[2K${line2}\n`);
      }
      return;
    }

    const rounded = Math.round(p);
    if (rounded !== this.lastPrintedPct) {
      this.lastPrintedPct = rounded;
      const suffix = label ? ` — ${label}` : "";
      process.stdout.write(`[${rounded}%]${suffix}\n`);
    }
  }

  /** Leave the bar at 100% and move cursor below it for further logs. */
  finish(pct = 100, status = "Done") {
    this.update(pct, status);
    if (this.tty && this.started) {
      process.stdout.write("\n");
      this.started = false;
    }
  }

  /** Exit without marking 100% (e.g. validation failure after partial progress). */
  abandon() {
    if (this.tty && this.started) {
      process.stdout.write("\n");
      this.started = false;
    }
  }
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

/**
 * @param {string} clientId
 * @param {string} token
 * @param {(ev: { type: "page"; pagesDone: number } | { type: "done"; pagesDone: number; count: number }) => void} [onProgress]
 */
async function fetchAllSwitchGames(clientId, token, onProgress) {
  const seen = new Set();
  const games = [];
  let offset = 0;
  let pagesDone = 0;

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
    if (page.length === 0) {
      onProgress?.({ type: "done", pagesDone, count: games.length });
      break;
    }

    pagesDone += 1;
    for (const g of page) {
      const gid = g?.id;
      if (typeof gid !== "number" || seen.has(gid)) continue;
      seen.add(gid);
      games.push(g);
    }

    onProgress?.({ type: "page", pagesDone });

    if (page.length < GAMES_PAGE_LIMIT) {
      onProgress?.({ type: "done", pagesDone, count: games.length });
      break;
    }
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

/**
 * @param {(chunkIndex: number, chunkCount: number) => void} [onChunk]
 */
async function fetchVideoRows(clientId, token, ids, onChunk) {
  const map = new Map();
  const chunkCount = Math.ceil(ids.length / VIDEO_CHUNK) || 0;
  let chunkIndex = 0;
  for (let i = 0; i < ids.length; i += VIDEO_CHUNK) {
    const slice = ids.slice(i, i + VIDEO_CHUNK);
    if (slice.length === 0) continue;
    chunkIndex += 1;
    const body = `where id = (${slice.join(",")}); fields video_id,name; limit ${slice.length};`;
    const rows = await igdbPost(IGDB_GAME_VIDEOS_URL, clientId, token, body);
    onChunk?.(chunkIndex, chunkCount);
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

  const progress = new CliProgress();
  progress.update(1, "Authenticating with Twitch…");
  const token = await twitchToken(id, secret);
  progress.update(4, "Authenticated");

  const games = await fetchAllSwitchGames(id, token, (ev) => {
    if (ev.type === "page") {
      const t = asymptoticPagesT(ev.pagesDone);
      progress.update(5 + 38 * t, `IGDB games · page ${ev.pagesDone}`);
    } else {
      progress.update(
        45,
        `IGDB games · ${ev.count.toLocaleString()} titles (${ev.pagesDone} page${ev.pagesDone === 1 ? "" : "s"})`,
      );
    }
  });

  if (games.length === 0) {
    progress.abandon();
    throw new Error(
      "No Nintendo Switch games returned from IGDB (check credentials / query).",
    );
  }

  const vidIds = collectVideoIds(games);
  const videoById =
    vidIds.length > 0
      ? await fetchVideoRows(id, token, vidIds, (chunkIndex, chunkCount) => {
          const span = 44;
          const base = 45;
          const p =
            chunkCount > 0
              ? base + (span * chunkIndex) / chunkCount
              : base + span;
          progress.update(p, `Game videos · chunk ${chunkIndex}/${chunkCount}`);
        })
      : new Map();

  if (vidIds.length === 0) {
    progress.update(89, "No trailer IDs to resolve");
  } else {
    progress.update(
      89,
      `Resolved ${vidIds.length.toLocaleString()} video refs`,
    );
  }

  const totalGames = games.length;
  const outGames = [];
  for (let idx = 0; idx < games.length; idx++) {
    const g = games[idx];
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
    const scanned = idx + 1;
    if (scanned % 48 === 0 || scanned === totalGames) {
      progress.update(
        89 + (9 * scanned) / totalGames,
        `Building JSON · ${scanned.toLocaleString()}/${totalGames.toLocaleString()} rows`,
      );
    }
  }

  progress.update(98.5, "Writing file…");
  const payload = {
    generatedAt: new Date().toISOString(),
    games: outGames,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  progress.finish(100, "Complete");

  console.log(
    `Wrote ${outGames.length} Nintendo Switch games (platform ${NINTENDO_SWITCH_PLATFORM_ID}) to ${OUT}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
