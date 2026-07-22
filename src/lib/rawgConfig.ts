export function getRawgProxyBase(): string {
  const base = import.meta.env.VITE_RAWG_PROXY_BASE;
  if (typeof base !== "string") return "";
  const trimmed = base.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function usesRawgProxy(): boolean {
  return getRawgProxyBase().length > 0;
}
