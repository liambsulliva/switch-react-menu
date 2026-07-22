import { usesRawgProxy } from "../../lib/rawgConfig";
import { getBuiltInRawgApiKey } from "../../settings/rawgApiKeyStore";
import { MOCK_APPS } from "../mock-data/apps";
import { normalizeGameTitleForMatch } from "../../lib/gameTitleMatch";

const RAWG_HOST = "api.rawg.io";

type MockRawgGame = {
  id: number;
  slug: string;
  name: string;
  released: string;
  background_image: string | null;
  description_raw: string;
  genres: Array<{ name: string }>;
  tags: Array<{ name: string; language: string }>;
  platforms: Array<{ platform: { id: number; name: string } }>;
};

const MOCK_RAWG_GAMES: MockRawgGame[] = MOCK_APPS.map((app, index) => ({
  id: 10_000 + index,
  slug: app.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, ""),
  name: app.name,
  released: "2020-01-15",
  background_image: null,
  description_raw: `<p>Browser preview metadata for ${app.name}.</p>`,
  genres: [{ name: "Action" }],
  tags: [{ name: "Singleplayer", language: "eng" }],
  platforms: [{ platform: { id: 7, name: "Nintendo Switch" } }],
}));

function findMockGame(search: string): MockRawgGame | null {
  const norm = normalizeGameTitleForMatch(search);
  if (!norm) return null;
  for (const game of MOCK_RAWG_GAMES) {
    const gn = normalizeGameTitleForMatch(game.name);
    if (norm === gn || gn.includes(norm) || norm.includes(gn)) {
      return game;
    }
  }
  return MOCK_RAWG_GAMES[0] ?? null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function handleRawgRequest(input: RequestInfo | URL, init?: RequestInit): Response | null {
  const url =
    typeof input === "string"
      ? new URL(input, "https://api.rawg.io")
      : input instanceof URL
        ? input
        : new URL(input.url);

  if (url.hostname !== RAWG_HOST) return null;

  const key = url.searchParams.get("key");
  if (!key) {
    return jsonResponse({ detail: "API key required" }, 401);
  }

  if (url.pathname === "/api/platforms") {
    return jsonResponse({
      count: 1,
      results: [{ id: 7, name: "Nintendo Switch", slug: "nintendo-switch" }],
    });
  }

  const gamesMatch = url.pathname.match(/^\/api\/games\/([^/]+)(?:\/movies)?$/);
  if (gamesMatch) {
    const slugOrId = decodeURIComponent(gamesMatch[1]!);
    const game =
      MOCK_RAWG_GAMES.find(
        (g) => g.slug === slugOrId || String(g.id) === slugOrId,
      ) ?? findMockGame(slugOrId);

    if (!game) {
      return jsonResponse({ detail: "Not found" }, 404);
    }

    if (url.pathname.endsWith("/movies")) {
      return jsonResponse({ count: 0, results: [] });
    }

    return jsonResponse(game);
  }

  if (url.pathname === "/api/games") {
    const search = url.searchParams.get("search") ?? "";
    const game = findMockGame(search);
    if (!game) {
      return jsonResponse({ count: 0, results: [] });
    }
    return jsonResponse({ count: 1, results: [game] });
  }

  return jsonResponse({ detail: "Not mocked" }, 404);
}

export function installRawgFetchPolyfill(): void {
  if (usesRawgProxy() || getBuiltInRawgApiKey()) return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const mocked = handleRawgRequest(input, init);
    if (mocked) return mocked;
    return originalFetch(input, init);
  }) as typeof fetch;
}
