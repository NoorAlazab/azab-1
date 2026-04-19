export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/iron";
import { assertValidCsrf } from "@/lib/security/csrf";
import { serializeSteps } from "@/lib/generator/stepsJson";

export async function POST(req: Request) { // add
  try { assertValidCsrf(); } catch(e:any){ return new Response(JSON.stringify({error:"Invalid CSRF token"}), {status:403}); }
  
  try {
    const userId = await requireUserId();
    const { suiteId, title, steps, expected, priority, order } = await req.json().catch(()=> ({}));
    if (!suiteId || !title || !Array.isArray(steps) || !expected) return NextResponse.json({ ok:false, error:"MISSING_FIELDS" }, { status:400 });
    // ensure suite belongs to user
    const suite = await prisma.testSuite.findFirst({ where: { id: suiteId, userId } });
    if (!suite) return NextResponse.json({ ok:false, error:"SUITE_NOT_FOUND" }, { status:404 });

    const created = await prisma.testCase.create({
      data: { suiteId, title, stepsJson: serializeSteps(steps), expected, priority, order: order ?? 0 }
    });

    await prisma.testSuite.update({ where: { id: suiteId }, data: { dirty: true } });
    
    return NextResponse.json({ ok:true, case: { id: created.id } });
  } catch (error) {
    console.error("Create test case error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create test case" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) { // edit
  try { assertValidCsrf(); } catch(e:any){ return new Response(JSON.stringify({error:"Invalid CSRF token"}), {status:403}); }
  
  try {
    const userId = await requireUserId();
    const { id, title, steps, expected, priority, order } = await req.json().catch(()=> ({}));
    if (!id) return NextResponse.json({ ok:false, error:"ID_REQUIRED" }, { status:400 });
    const found = await prisma.testCase.findUnique({ where: { id } });
    if (!found) return NextResponse.json({ ok:false, error:"NOT_FOUND" }, { status:404 });
    const suite = await prisma.testSuite.findFirst({ where: { id: found.suiteId, userId } });
    if (!suite) return NextResponse.json({ ok:false, error:"FORBIDDEN" }, { status:403 });

    const updated = await prisma.testCase.update({
      where: { id },
      data: {
        title: title ?? found.title,
        stepsJson: Array.isArray(steps) ? serializeSteps(steps) : serializeSteps(found.stepsJson),
        expected: expected ?? found.expected,
        priority: priority ?? found.priority,
        order: typeof order === "number" ? order : found.order,
      }
    });

    await prisma.testSuite.update({ where: { id: found.suiteId }, data: { dirty: true } });
    
    return NextResponse.json({ ok:true, case: { id: updated.id } });
  } catch (error) {
    console.error("Update test case error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update test case" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try { assertValidCsrf(); } catch(e:any){ return new Response(JSON.stringify({error:"Invalid CSRF token"}), {status:403}); }
  
  try {
    const userId = await requireUserId();
    const { id } = await req.json().catch(()=> ({}));
    if (!id) return NextResponse.json({ ok:false, error:"ID_REQUIRED" }, { status:400 });
    const found = await prisma.testCase.findUnique({ where: { id } });
    if (!found) return NextResponse.json({ ok:false, error:"NOT_FOUND" }, { status:404 });
    const suite = await prisma.testSuite.findFirst({ where: { id: found.suiteId, userId } });
    if (!suite) return NextResponse.json({ ok:false, error:"FORBIDDEN" }, { status:403 });

    await prisma.testCase.delete({ where: { id } });

    await prisma.testSuite.update({ where: { id: found.suiteId }, data: { dirty: true } });
    
    return NextResponse.json({ ok:true });
  } catch (error) {
    console.error("Delete test case error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete test case" },
      { status: 500 }
    );
  }
}