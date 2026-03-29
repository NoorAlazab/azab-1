export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/iron";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const s = await getSession();
  if (!s.userId) return NextResponse.json({ user: null, jira: { connected: false } });

  const jt = await (prisma as any).jiraToken.findUnique({ where: { userId: s.userId } });
  const connected = Boolean(jt?.refreshCipher);
  return NextResponse.json({
    user: { id: s.userId, email: s.userEmail, name: s.userName },
    jira: { connected, activeCloudId: jt?.cloudId ?? null },
  });
}