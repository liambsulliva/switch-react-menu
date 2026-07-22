const SWITCH_MENU_PREFIX = "/switch-menu";

export function isSwitchMenuEmbedRequest(request: Request): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest === "iframe") return true;

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    const refUrl = new URL(referer);
    const reqUrl = new URL(request.url);
    if (refUrl.origin !== reqUrl.origin) return false;
    return !refUrl.pathname.startsWith(SWITCH_MENU_PREFIX);
  } catch {
    return false;
  }
}

export function isRawgProxyRequestAllowed(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== "same-origin" && site !== "same-site") return false;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const ref = new URL(referer);
      if (ref.pathname.startsWith(SWITCH_MENU_PREFIX)) return true;
    } catch {
      return false;
    }
  }

  const dest = request.headers.get("sec-fetch-dest");
  return dest === "empty";
}

export function switchMenuSecurityHeaders(): HeadersInit {
  return {
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": "frame-ancestors 'self'",
    "Cache-Control": "no-store",
  };
}
