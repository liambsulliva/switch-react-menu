import type { APIRoute } from "astro";
import fs from "node:fs/promises";
import path from "node:path";
import {
  isSwitchMenuEmbedRequest,
  switchMenuSecurityHeaders,
} from "../../lib/switchMenuEmbed";

export const prerender = false;

const INDEX_PATH = path.join(
  process.cwd(),
  "private",
  "switch-menu",
  "index.html",
);

export const GET: APIRoute = async ({ request, redirect }) => {
  if (!isSwitchMenuEmbedRequest(request)) {
    return redirect("/");
  }

  let html: string;
  try {
    html = await fs.readFile(INDEX_PATH, "utf-8");
  } catch {
    return new Response("Switch menu embed is unavailable.", { status: 503 });
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...switchMenuSecurityHeaders(),
    },
  });
};
