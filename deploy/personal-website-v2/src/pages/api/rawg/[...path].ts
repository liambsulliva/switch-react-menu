import type { APIRoute } from "astro";
import { isRawgProxyRequestAllowed } from "../../lib/switchMenuEmbed";

export const prerender = false;

const RAWG_API_BASE = "https://api.rawg.io/api";

export const ALL: APIRoute = async ({ params, request, url }) => {
  if (!isRawgProxyRequestAllowed(request)) {
    return new Response(JSON.stringify({ detail: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = import.meta.env.RAWG_API_KEY?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ detail: "RAWG proxy not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pathSuffix = params.path?.trim() ?? "";
  const target = new URL(
    pathSuffix ? `${RAWG_API_BASE}/${pathSuffix}` : RAWG_API_BASE,
  );
  target.searchParams.set("key", apiKey);

  for (const [key, value] of url.searchParams.entries()) {
    if (key !== "key") target.searchParams.set(key, value);
  }

  const upstream = await fetch(target.toString(), {
    headers: { Accept: "application/json" },
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
};
