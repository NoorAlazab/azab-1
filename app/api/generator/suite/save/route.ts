export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/iron";
import { assertValidCsrf } from "@/lib/security/csrf";

export async function POST(req: Request) {
  try { 
    assertValidCsrf(); 
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token" }), { 
      status: 403, 
      headers: { "content-type": "application/json" } 
    });
  }

  try {
    const userId = await requireUserId();
    const { suiteId, environment, cases } = await req.json().catch(() => ({}));
    
    if (!suiteId || !Array.isArray(cases)) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }

    // Verify suite belongs to user
    const suite = await prisma.testSuite.findFirst({ 
      where: { id: suiteId, userId } 
    });
    
    if (!suite) {
      return NextResponse.json({ ok: false, error: "SUITE_NOT_FOUND" }, { status: 404 });
    }

    // Replace all cases in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing cases
      await tx.testCase.deleteMany({
        where: { suiteId }
      });

      // Create new cases
      const newCases = cases.map((tc, index) => ({
        suiteId,
        title: tc.title,
        stepsJson: tc.steps,
        expected: tc.expected,
        priority: tc.priority || "P2",
        type: tc.type || "functional",
        order: tc.order ?? index
      }));

      if (newCases.length > 0) {
        await tx.testCase.createMany({
          data: newCases
        });
      }

      // Update suite environment, status, clear dirty flag and set lastSavedAt
      const updatedSuite = await (tx as any).testSuite.update({
        where: { id: suiteId },
        data: {
          environment: environment ?? suite.environment,
          status: "draft",
          dirty: false,
          lastSavedAt: new Date(),
          updatedAt: new Date()
        }
      });

      return { suite: updatedSuite, count: newCases.length };
    });

    return NextResponse.json({ 
      ok: true, 
      count: result.count, 
      suiteId: result.suite.id 
    });

  } catch (error) {
    console.error("Save suite error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to save suite" },
      { status: 500 }
    );
  }
}