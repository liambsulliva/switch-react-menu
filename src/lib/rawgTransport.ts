const RAWG_API_HOST = "api.rawg.io";

function normalizeProxyBase(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

export function getRawgProxyBase(): string | null {
  return normalizeProxyBase(import.meta.env.VITE_RAWG_PROXY_BASE);
}

export function usesRawgProxy(): boolean {
  return getRawgProxyBase() !== null;
}

export function isEmbedOnlyBuild(): boolean {
  return import.meta.env.VITE_EMBED_ONLY === "true";
}

export function isRawgProxyUrl(url: URL): boolean {
  if (url.hostname === RAWG_API_HOST) return true;
  const proxyBase = getRawgProxyBase();
  if (!proxyBase) return false;
  return url.pathname === proxyBase || url.pathname.startsWith(`${proxyBase}/`);
}
