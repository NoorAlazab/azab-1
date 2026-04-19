import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge middleware for route gating.
 *
 * IMPORTANT — security model:
 * --------------------------------------------------------------------
 * This middleware runs on the Edge runtime, where we cannot decrypt
 * the iron-session cookie (no Node `crypto`). Therefore this is a
 * lightweight "presence" check only. It detects whether a session
 * cookie exists at all and bounces unauthenticated users to /login
 * BEFORE the expensive page render runs.
 *
 * Real authentication (verifying that the cookie is valid, not
 * tampered with, and contains a live `userId`) MUST happen
 * server-side per route via `requireUserId()` from
 * `lib/auth/iron.ts`. The middleware is a UX optimization, not a
 * security boundary.
 *
 * API routes are intentionally NOT matched here. They each call
 * `requireUserId()` and return a JSON 401, which is the correct
 * contract for API consumers (a redirect to an HTML /login page
 * would corrupt their response).
 */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/generator/:path*",
    "/exploration/:path*",
    "/exploration-v2/:path*",
    "/integrations/:path*",
    "/settings/:path*",
    "/jira-preflight/:path*",
    "/oauth-debug/:path*",
    "/reconnect-jira/:path*",
  ],
};

const SESSION_COOKIE_NAME = "qacf_session";

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie && cookie.length > 0) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  const nextPath = req.nextUrl.pathname + req.nextUrl.search;
  if (nextPath && nextPath !== "/" && nextPath !== "/login") {
    loginUrl.searchParams.set("next", nextPath);
  }
  return NextResponse.redirect(loginUrl);
}
