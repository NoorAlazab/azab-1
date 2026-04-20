export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/iron";
import { prisma } from "@/lib/server/db/prisma";

export async function GET() {
  const s = await getSession();
  if (!s.userId) return NextResponse.json({ ok: true, user: null, jira: { connected: false } });

  // Get user data from database
  const user = await prisma.user.findUnique({
    where: { id: s.userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
  }

  const jt = await prisma.jiraToken.findUnique({ where: { userId: s.userId } });
  const connected = Boolean(jt?.refreshCipher);
  
  // Generate initials from name or email
  const getInitials = (name: string | null, email: string): string => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };
  
  return NextResponse.json({
    ok: true,
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.name || user.email,
      initials: getInitials(user.name, user.email),
    },
    jira: { connected, cloudId: jt?.cloudId ?? null },
  });
}