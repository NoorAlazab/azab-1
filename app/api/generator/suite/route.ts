export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/iron";
import { assertValidCsrf } from "@/lib/security/csrf";
import { deserializeSteps } from "@/lib/generator/stepsJson";

export async function POST(req: Request) {
  try { assertValidCsrf(); } catch (e:any) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token" }), { status: 403, headers: { "content-type": "application/json" } });
  }
  const userId = await requireUserId();
  const { issueKey, cloudId } = await req.json().catch(() => ({}));
  if (!issueKey || !cloudId) return NextResponse.json({ ok:false, error:"MISSING_FIELDS" }, { status:400 });

  // True upsert on (userId, issueKey)
  const suite = await prisma.testSuite.upsert({
    where: { uniq_user_issue: { userId, issueKey } },
    update: { cloudId },
    create: { userId, issueKey, cloudId },
  });

  const cases = await prisma.testCase.findMany({ where: { suiteId: suite.id }, orderBy: { order: "asc" } });

  return NextResponse.json({
    ok: true,
    suite: { 
      id: suite.id, 
      issueKey: suite.issueKey, 
      status: suite.status,
      dirty: (suite as any).dirty || false,
      lastSavedAt: (suite as any).lastSavedAt || null
    },
    cases: cases.map(c => ({ id: c.id, title: c.title, steps: deserializeSteps(c.stepsJson), expected: c.expected, priority: c.priority as any, order: c.order })),
  });
}