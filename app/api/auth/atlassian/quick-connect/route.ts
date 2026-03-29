export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getFreshAccessToken } from "@/lib/jira/tokenService";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/iron";

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const fresh = await getFreshAccessToken(userId);
  if (!fresh) {
    return NextResponse.json({ ok: false, reason: "no_token" }, { status: 404 });
  }
  const site = await (prisma as any).jiraToken.findFirst({ where: { userId }, select: { cloudId: true } });

  return NextResponse.json({
    ok: true,
    accessTokenPresent: true,
    cloudId: site?.cloudId ?? fresh.cloudId,
    expiresAt: fresh.accessExpiresAt.toISOString(),
  });
}