import { prisma } from "@/lib/db/prisma";
import { decrypt, encrypt } from "@/lib/crypto/secrets";

const CLIENT_ID = process.env.ATLASSIAN_CLIENT_ID!;
const CLIENT_SECRET = process.env.ATLASSIAN_CLIENT_SECRET!;
const SKEW_MS = 60_000;

export type FreshToken = {
  accessToken: string;
  accessExpiresAt: Date;
  cloudId: string;
  scope?: string;
};

export async function getFreshAccessTokenForUser(userId: string) {
  const rec = await (prisma as any).jiraToken.findUnique({ where: { userId } });
  if (!rec) return null;
  const now = Date.now();
  if (rec.accessToken && rec.accessExpiresAt && rec.accessExpiresAt.getTime() - SKEW_MS > now) {
    return { accessToken: decrypt(rec.accessToken), cloudId: rec.cloudId, expiresAt: rec.accessExpiresAt };
  }
  const body = {
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: decrypt(rec.refreshCipher),
  };
  const res = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const tok = await res.json();
  const accessToken = tok.access_token as string;
  const expiresAt = new Date(Date.now() + Number(tok.expires_in || 3600) * 1000);
  const data: any = { accessToken: encrypt(accessToken), accessExpiresAt: expiresAt, scope: tok.scope ?? rec.scope };
  if (tok.refresh_token) data.refreshCipher = encrypt(tok.refresh_token);
  await (prisma as any).jiraToken.update({ where: { userId }, data });
  return { accessToken, cloudId: rec.cloudId, expiresAt };
}

// Keep the old function for compatibility
export async function getFreshAccessToken(userId: string): Promise<FreshToken | null> {
  const result = await getFreshAccessTokenForUser(userId);
  if (!result) return null;
  return {
    accessToken: result.accessToken,
    accessExpiresAt: result.expiresAt,
    cloudId: result.cloudId,
    scope: undefined
  };
}