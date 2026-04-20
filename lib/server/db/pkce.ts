import { prisma } from "@/lib/server/db/prisma";
import type { PKCESession } from "@/types/auth";

/**
 * Persist a PKCE session for the duration of an OAuth round-trip.
 * Backed by the `pkce_sessions` table so OAuth flows survive a server
 * restart, unlike the previous in-memory map.
 */
export async function savePKCESession(
  nonce: string,
  session: PKCESession,
): Promise<void> {
  await prisma.pkceSession.upsert({
    where: { nonce },
    update: {
      codeVerifier: session.codeVerifier,
      state: session.state,
      returnTo: session.returnTo ?? null,
      expiresAt: session.expiresAt,
    },
    create: {
      nonce,
      codeVerifier: session.codeVerifier,
      state: session.state,
      returnTo: session.returnTo ?? null,
      expiresAt: session.expiresAt,
    },
  });
}

export async function getPKCESession(
  nonce: string,
): Promise<PKCESession | null> {
  const row = await prisma.pkceSession.findUnique({ where: { nonce } });
  if (!row) return null;

  // Treat expired sessions as missing and lazily prune them.
  if (row.expiresAt < new Date()) {
    await prisma.pkceSession.delete({ where: { nonce } }).catch(() => undefined);
    return null;
  }

  return {
    nonce: row.nonce,
    codeVerifier: row.codeVerifier,
    state: row.state,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    returnTo: row.returnTo ?? undefined,
  };
}

export async function deletePKCESession(nonce: string): Promise<void> {
  await prisma.pkceSession.delete({ where: { nonce } }).catch(() => undefined);
}

/**
 * Best-effort sweep of expired PKCE sessions. Safe to call from a route
 * handler — it deletes by index on `expiresAt` and returns the count.
 */
export async function pruneExpiredPKCESessions(): Promise<number> {
  const res = await prisma.pkceSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}
