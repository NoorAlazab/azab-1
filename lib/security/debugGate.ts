import { NextResponse } from "next/server";

/**
 * Guard for debug / diagnostics endpoints.
 *
 * Returns a 404 NextResponse when the runtime is production AND the
 * ALLOW_DEBUG_ENDPOINTS env flag is not explicitly enabled. In dev /
 * test the gate lets the request through (returns null).
 *
 * Use at the top of a debug route handler:
 *
 *   const blocked = denyIfProduction();
 *   if (blocked) return blocked;
 *
 * 404 (not 403) is intentional: we do not want to confirm to an
 * unauthenticated scanner that a debug surface even exists.
 */
export function denyIfProduction(): NextResponse | null {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEBUG_ENDPOINTS !== "1"
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return null;
}
