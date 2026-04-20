import { NextResponse } from "next/server";

/**
 * Consistent JSON envelope for all API responses.
 *
 * Every successful response has the shape  { ok: true,  data?: T }
 * Every failure response has the shape     { ok: false, error: string, message?: string, details?: unknown }
 *
 * Why a uniform envelope?
 *   - Clients can branch on `ok` once instead of checking dozens of
 *     ad-hoc shapes ("ok", "success", "error", presence of "data", etc).
 *   - Mistakes like throwing a 200 with `{ error: "..." }` (which the
 *     dashboard cannot distinguish from success without inspecting the
 *     status code) become impossible.
 *   - Adding tracing IDs / pagination cursors later requires changing
 *     ONE place.
 *
 * NOTE: many existing routes still return ad-hoc shapes (e.g. {success:true}
 * or `{ ok:true, suite:{...}, cases:[...] }`). Migrating them is mechanical
 * but high-touch, so it is being done route-by-route. The helpers here are
 * the single canonical surface going forward — please reach for them in
 * any new route.
 */

export type ApiOk<T> = { ok: true; data?: T };
export type ApiErr = {
  ok: false;
  error: string;
  message?: string;
  details?: unknown;
};

export function apiOk<T>(data?: T, init?: ResponseInit): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function apiError(
  error: string,
  status: number,
  opts: { message?: string; details?: unknown } = {},
): NextResponse<ApiErr> {
  return NextResponse.json(
    { ok: false, error, ...opts },
    { status },
  );
}
