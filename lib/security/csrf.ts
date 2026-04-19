import crypto from "crypto";
import { cookies, headers } from "next/headers";

const COOKIE_NAME = "csrf_token";

export function issueCsrfToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  // Non-HTTP-only so client can read? We're using header, still need the cookie to match.
  // Double-submit pattern: cookie value must equal header value.
  cookies().set(COOKIE_NAME, token, {
    httpOnly: false,           // must be readable by browser JS for header; risk mitigated by SameSite + origin check
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,           // 1 hour
  });
  return token;
}

export function readCsrfCookie(): string | null {
  return cookies().get(COOKIE_NAME)?.value ?? null;
}

export function readCsrfHeader(): string | null {
  // Support both x-csrf-token and X-CSRF-Token
  const h = headers();
  return (h.get("x-csrf-token") ?? h.get("X-CSRF-Token")) || null;
}

export class CsrfError extends Error {
  status = 403 as const;
  constructor(message = "Invalid CSRF token") {
    super(message);
    this.name = "CsrfError";
  }
}

/** Throws on failure. Call at the top of POST/PATCH/DELETE handlers. */
export function assertValidCsrf(): void {
  const c = readCsrfCookie();
  const h = readCsrfHeader();
  if (!c || !h || c !== h) {
    throw new CsrfError();
  }
}