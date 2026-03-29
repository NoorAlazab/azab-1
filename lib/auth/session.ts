import { NextRequest, NextResponse } from "next/server";
import { randomId } from "@/lib/crypto";
import { setCookie, getCookie, clearCookie } from "@/lib/cookies";
import { SessionPayload } from "@/types/auth";
import { createSession, getSession, deleteSession } from "@/lib/db/mock";

const SESSION_COOKIE_NAME = "session";
const CSRF_COOKIE_NAME = "csrf";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Create a new session for a user
 */
export async function createUserSession(
  response: NextResponse,
  userId: string,
  email: string
): Promise<string> {
  const sessionId = randomId(32);
  const csrfToken = randomId(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION);

  const session: SessionPayload = {
    userId,
    email,
    csrfToken,
    createdAt: now,
    expiresAt,
  };

  await createSession(sessionId, session);

  // Set session cookie
  setCookie(response, SESSION_COOKIE_NAME, sessionId, {
    maxAge: SESSION_DURATION / 1000,
    expires: expiresAt,
  });

  // Set CSRF token cookie (for server-side verification)
  setCookie(response, CSRF_COOKIE_NAME, csrfToken, {
    maxAge: SESSION_DURATION / 1000,
    expires: expiresAt,
  });

  return sessionId;
}

/**
 * Get current session from request
 */
export async function getCurrentSession(request: NextRequest): Promise<SessionPayload | null> {
  const sessionId = getCookie(request, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return null;
  }

  return await getSession(sessionId);
}

/**
 * Clear user session
 */
export async function clearUserSession(response: NextResponse, request: NextRequest): Promise<void> {
  const sessionId = getCookie(request, SESSION_COOKIE_NAME);
  
  if (sessionId) {
    await deleteSession(sessionId);
  }

  clearCookie(response, SESSION_COOKIE_NAME);
  clearCookie(response, CSRF_COOKIE_NAME);
}

/**
 * Verify CSRF token from request
 */
export async function verifyCsrfToken(request: NextRequest): Promise<boolean> {
  const session = await getCurrentSession(request);
  if (!session) {
    return false;
  }

  // Get CSRF token from header or body
  let csrfToken: string | null = null;
  
  // Try to get from header first
  csrfToken = request.headers.get("x-csrf-token");
  
  // If not in header, try to get from body (for form submissions)
  if (!csrfToken) {
    try {
      const body = await request.clone().json();
      csrfToken = body.csrfToken;
    } catch {
      // Body might not be JSON, ignore
    }
  }

  return csrfToken === session.csrfToken;
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(request: NextRequest): Promise<SessionPayload | NextResponse> {
  const session = await getCurrentSession(request);
  
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  return session;
}

/**
 * Middleware to require authentication and CSRF verification for state-changing operations
 */
export async function requireAuthAndCsrf(request: NextRequest): Promise<SessionPayload | NextResponse> {
  const session = await getCurrentSession(request);
  
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Only verify CSRF for non-GET requests
  if (request.method !== "GET" && request.method !== "HEAD") {
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      );
    }
  }

  return session;
}