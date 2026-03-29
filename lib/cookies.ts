import { serialize, parse } from "cookie";
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { constantTimeEqual } from "@/lib/crypto";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Set a signed cookie
 */
export function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: {
    maxAge?: number;
    expires?: Date;
  } = {}
): void {
  const env = getEnv();
  const signature = signValue(value, env.SESSION_SECRET);
  const signedValue = `${value}.${signature}`;

  const cookie = serialize(name, signedValue, {
    ...COOKIE_OPTIONS,
    ...options,
  });

  response.headers.append("Set-Cookie", cookie);
}

/**
 * Get and verify a signed cookie
 */
export function getCookie(request: NextRequest, name: string): string | null {
  const cookies = parse(request.headers.get("cookie") || "");
  const signedValue = cookies[name];

  if (!signedValue) {
    return null;
  }

  const env = getEnv();
  return unsignValue(signedValue, env.SESSION_SECRET);
}

/**
 * Clear a cookie
 */
export function clearCookie(response: NextResponse, name: string): void {
  const cookie = serialize(name, "", {
    ...COOKIE_OPTIONS,
    expires: new Date(0),
  });

  response.headers.append("Set-Cookie", cookie);
}

/**
 * Sign a value using HMAC
 */
function signValue(value: string, secret: string): string {
  // Simple signing - in production, you'd want to use a proper HMAC implementation
  // This is a simplified version for the demo
  const crypto = require("crypto");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Unsign and verify a signed value
 */
function unsignValue(signedValue: string, secret: string): string | null {
  const lastDotIndex = signedValue.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return null;
  }

  const value = signedValue.slice(0, lastDotIndex);
  const signature = signedValue.slice(lastDotIndex + 1);

  const expectedSignature = signValue(value, secret);

  // Use constant-time comparison to prevent timing attacks
  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  return value;
}