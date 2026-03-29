import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pkce_oauth";
const TTL_SEC = 10 * 60; // 10 minutes

export function randomUrlSafe(n = 43) {
  return crypto.randomBytes(n).toString("base64url");
}

export function codeChallengeS256(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// Keep verifier length 43..128 chars:
export function genVerifier() {
  return randomUrlSafe(64); // ~86 chars base64url
}

export function setPkceCookie(state: string, codeVerifier: string) {
  const payload = JSON.stringify({ state, codeVerifier, ts: Date.now() });
  cookies().set(COOKIE_NAME, payload, {
    httpOnly: true,
    sameSite: "lax",          // sent on top-level GET from Atlassian back to us
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SEC,
    path: "/",
  });
}

export function readAndConsumePkceCookie(expectedState: string): string {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) throw new Error("PKCE cookie missing");
  
  // Clear the cookie immediately
  cookies().set(COOKIE_NAME, "", { 
    httpOnly: true, 
    sameSite: "lax", 
    secure: process.env.NODE_ENV === "production", 
    maxAge: 0, 
    path: "/" 
  });
  
  let parsed: { state: string; codeVerifier: string; ts: number };
  try { 
    parsed = JSON.parse(c.value); 
  } catch { 
    throw new Error("PKCE cookie parse error"); 
  }
  
  if (parsed.state !== expectedState) throw new Error("PKCE state mismatch");
  if (Date.now() - parsed.ts > TTL_SEC * 1000) throw new Error("PKCE cookie expired");
  
  return parsed.codeVerifier;
}