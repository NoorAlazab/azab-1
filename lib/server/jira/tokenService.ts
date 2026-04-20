import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db/prisma";
import { decrypt, encrypt } from "@/lib/server/crypto/secrets";
import { fetchWithRetry } from "@/lib/server/jira/retry";

const CLIENT_ID = process.env.ATLASSIAN_CLIENT_ID!;
const CLIENT_SECRET = process.env.ATLASSIAN_CLIENT_SECRET!;
const SKEW_MS = 60_000;

export type FreshToken = {
  accessToken: string;
  accessExpiresAt: Date;
  cloudId: string;
  scope?: string;
};

type FreshTokenResult = {
  accessToken: string;
  cloudId: string;
  expiresAt: Date;
};

/**
 * In-process lock for refresh-token exchanges, keyed by userId.
 *
 * Prevents the "thundering herd" problem where N concurrent requests for the
 * same user all see an expired access token, all fire a refresh against
 * Atlassian's token endpoint at once, and (worst case) clobber each other's
 * rotated refresh_token in the database. With this lock the first caller
 * does the network round-trip; the rest await the same in-flight promise
 * and reuse the result.
 *
 * NOTE: This is process-local. Across multiple Node processes (e.g. when
 * scaled horizontally) refresh races are still possible — solving that
 * requires a distributed lock (Redis SETNX or a DB row lock). That is
 * deliberately out of scope here; for a single-instance dev/staging
 * deployment this lock removes the common case.
 */
const refreshLocks = new Map<string, Promise<FreshTokenResult | null>>();

export async function getFreshAccessTokenForUser(
  userId: string,
): Promise<FreshTokenResult | null> {
  const rec = await prisma.jiraToken.findUnique({ where: { userId } });
  if (!rec) return null;

  const now = Date.now();
  if (
    rec.accessToken &&
    rec.accessExpiresAt &&
    rec.accessExpiresAt.getTime() - SKEW_MS > now
  ) {
    return {
      accessToken: decrypt(rec.accessToken),
      cloudId: rec.cloudId,
      expiresAt: rec.accessExpiresAt,
    };
  }

  const inFlight = refreshLocks.get(userId);
  if (inFlight) return inFlight;

  const refreshPromise = (async (): Promise<FreshTokenResult | null> => {
    const body = {
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: decrypt(rec.refreshCipher),
    };
    const res = await fetchWithRetry(
      () =>
        fetch("https://auth.atlassian.com/oauth/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      {
        onRetry: ({ attempt, delayMs, reason }) => {
          // eslint-disable-next-line no-console
          console.warn(
            `[jira] retrying token refresh for user=${userId} (${reason}) attempt=${attempt} after ${delayMs}ms`,
          );
        },
      },
    );
    if (!res.ok) return null;
    const tok = await res.json();
    const accessToken = tok.access_token as string;
    const expiresAt = new Date(Date.now() + Number(tok.expires_in || 3600) * 1000);
    const data: Prisma.JiraTokenUpdateInput = {
      accessToken: encrypt(accessToken),
      accessExpiresAt: expiresAt,
      scope: tok.scope ?? rec.scope,
    };
    if (tok.refresh_token) data.refreshCipher = encrypt(tok.refresh_token);
    await prisma.jiraToken.update({ where: { userId }, data });
    return { accessToken, cloudId: rec.cloudId, expiresAt };
  })();

  refreshLocks.set(userId, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    refreshLocks.delete(userId);
  }
}

// Keep the old function for compatibility
export async function getFreshAccessToken(userId: string): Promise<FreshToken | null> {
  const result = await getFreshAccessTokenForUser(userId);
  if (!result) return null;
  return {
    accessToken: result.accessToken,
    accessExpiresAt: result.expiresAt,
    cloudId: result.cloudId,
    scope: undefined,
  };
}
