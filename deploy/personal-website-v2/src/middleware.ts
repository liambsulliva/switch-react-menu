import type { MiddlewareHandler } from "astro";
import {
  clearDashboardChallengeCookie,
  createDashboardAuthChallenge,
  createDashboardAuthError,
  dashboardNoStoreHeaders,
  getDashboardChallengeCookie,
  requireDashboardApiRequest,
  verifyDashboardAuth,
} from "./lib/dashboardAuth";
import { isSwitchMenuEmbedRequest } from "./lib/switchMenuEmbed";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/api/cloudinary/add-tag",
  "/api/cloudinary/delete",
  "/api/cloudinary/remove-tag",
  "/api/cloudinary/upload",
];

const PROTECTED_API_PREFIXES = [
  "/api/cloudinary/add-tag",
  "/api/cloudinary/delete",
  "/api/cloudinary/remove-tag",
  "/api/cloudinary/upload",
];

const SWITCH_MENU_PREFIX = "/switch-menu";

function guardSwitchMenuDocument(request: Request, pathname: string): Response | null {
  if (pathname !== SWITCH_MENU_PREFIX && !pathname.startsWith(`${SWITCH_MENU_PREFIX}/`)) {
    return null;
  }

  // Static assets (JS/fonts) remain reachable for iframe loads.
  if (pathname.startsWith(`${SWITCH_MENU_PREFIX}/assets/`) ||
    pathname.startsWith(`${SWITCH_MENU_PREFIX}/fonts/`)) {
    return null;
  }

  if (pathname === SWITCH_MENU_PREFIX || pathname === `${SWITCH_MENU_PREFIX}/`) {
    if (!isSwitchMenuEmbedRequest(request)) {
      return Response.redirect(new URL("/", request.url), 302);
    }
  }

  return null;
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const url = new URL(context.request.url);

  const switchMenuGuard = guardSwitchMenuDocument(context.request, url.pathname);
  if (switchMenuGuard) return switchMenuGuard;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + "/"),
  );
  if (!isProtected) return next();

  const isProtectedApi = PROTECTED_API_PREFIXES.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + "/"),
  );

  if (isProtectedApi) {
    const apiFailure = await requireDashboardApiRequest(context.request);

    if (apiFailure) {
      return apiFailure;
    }

    const response = await next();
    Object.entries(dashboardNoStoreHeaders).forEach(([header, value]) => {
      response.headers.set(header, value);
    });

    return response;
  }

  if (!getDashboardChallengeCookie(context.request)) {
    return createDashboardAuthChallenge(context.request);
  }

  const authFailure = await verifyDashboardAuth(context.request);

  if (authFailure) {
    return authFailure.status === 401
      ? createDashboardAuthChallenge(context.request, authFailure.reason)
      : createDashboardAuthError(authFailure);
  }

  const response = await next();
  Object.entries(dashboardNoStoreHeaders).forEach(([header, value]) => {
    response.headers.set(header, value);
  });
  response.headers.append(
    "Set-Cookie",
    clearDashboardChallengeCookie(context.request),
  );

  return response;
};
