export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/iron";
import { assertValidCsrf } from "@/lib/security/csrf";
import { generateCasesAI } from "@/lib/ai/generateCases";
import { deserializeSteps, serializeSteps } from "@/lib/generator/stepsJson";
import { log } from "@/lib/utils/logger";

export async function POST(req: Request) {
  try {
    log.debug('Draft API called', { module: 'GeneratorDraft' });
    try { assertValidCsrf(); } catch(e:any){
      log.warn('CSRF validation failed', { module: 'GeneratorDraft', error: e.message });
      return new Response(JSON.stringify({ error:"Invalid CSRF token" }), { status: 403 });
    }

  const userId = await requireUserId();
  log.debug('User authenticated', { module: 'GeneratorDraft', userId });

  const body = await req.json().catch(()=> ({}));
  log.debug('Request body received', { module: 'GeneratorDraft', body });
  
  let { suiteId, issueKey, cloudId, story, mode, coverage, maxCases, cases } = body;

  if (!story?.summary) return NextResponse.json({ ok:false, error:"MISSING_STORY" }, { status: 400 });

  if (!suiteId) {
    if (!issueKey || !cloudId) return NextResponse.json({ ok:false, error:"MISSING_FIELDS" }, { status:400 });
    const suite = await (prisma as any).testSuite.upsert({
      where: { uniq_user_issue: { userId, issueKey } },
      update: { cloudId },
      create: { userId, issueKey, cloudId },
    });
    suiteId = suite.id;
  }

  const suite = await (prisma as any).testSuite.findFirst({ where: { id: suiteId, userId } });
  if (!suite) return NextResponse.json({ ok:false, error:"SUITE_NOT_FOUND" }, { status: 404 });

  let out;
  
  // Use provided cases if available, otherwise generate with AI
  if (cases && Array.isArray(cases) && cases.length > 0) {
    log.debug('Using provided manual test cases', {
      module: 'GeneratorDraft',
      count: cases.length,
      mode,
      cases: JSON.stringify(cases, null, 2)
    });
    out = cases;
  } else {
    log.ai('groq', 'llama-3.1-8b-instant', {
      module: 'GeneratorDraft',
      summary: String(story.summary).substring(0, 50) + '...',
      hasDescription: !!story.descriptionText,
      hasAC: !!story.acceptanceCriteriaText,
      coverage: coverage ?? "functional",
      maxCases: maxCases ?? 3
    });

    out = await generateCasesAI({
      summary: String(story.summary),
      description: String(story.descriptionText ?? ""),
      ac: String(story.acceptanceCriteriaText ?? ""),
      coverage: coverage ?? "functional",
      maxCases: maxCases ?? 3,
    });

    log.debug('AI generation completed', { module: 'GeneratorDraft', count: out.length });
  }

  // Fetch current to support append/dedup
  const existing = await (prisma as any).testCase.findMany({ where: { suiteId }, orderBy: { order: "asc" } });
  log.debug('Existing test cases in database', {
    module: 'GeneratorDraft',
    count: existing.length,
    cases: existing.map((tc: any) => `${tc.title} (${tc.type}, ${tc.priority})`)
  });

  const deduped = (mode === "append")
    ? dedupeByTitle([...existing.map((x: any) => ({ title:x.title } as any)), ...out]).slice(existing.length)
    : dedupeByTitle(out);

  log.debug('After deduplication', {
    module: 'GeneratorDraft',
    mode,
    dedupedCount: deduped.length,
    cases: deduped.map((tc: any) => `${tc.title} (${tc.type}, ${tc.priority})`)
  });

  // Handle overwrite mode by deleting existing cases first.
  // Single bulk DELETE is one DB round trip vs. one per case.
  if (mode === "overwrite") {
    log.debug('Overwrite mode: deleting existing cases', { module: 'GeneratorDraft', suiteId });
    const deleted = await (prisma as any).testCase.deleteMany({ where: { suiteId } });
    log.debug('Deleted existing cases', { module: 'GeneratorDraft', count: deleted.count });
  }

  // Create new test cases. Steps are stored as native JSON (Prisma serializes);
  // the previous JSON.stringify call double-encoded the payload.
  log.debug('Creating new test cases', { module: 'GeneratorDraft', count: deduped.length });
  const baseOrder = mode === "append" ? existing.length : 0;
  const casesToCreate = deduped.map((c: any, i: number) => ({
    suiteId,
    title: c.title,
    stepsJson: serializeSteps(c.steps),
    expected: c.expected,
    priority: c.priority ?? null,
    type: c.type ?? "functional",
    order: baseOrder + i,
  }));

  await (prisma as any).testCase.createMany({ data: casesToCreate });
  
  // Update suite status and mark as dirty
  await (prisma as any).testSuite.update({ 
    where: { id: suiteId }, 
    data: { status: "draft", dirty: true } 
  });

  const saved = await (prisma as any).testCase.findMany({ where: { suiteId }, orderBy: { order: "asc" } });
  log.debug('Successfully generated cases, returning response', { module: 'GeneratorDraft', count: saved.length });
  return NextResponse.json({
    ok: true,
    suiteId,
    mode: mode ?? "overwrite",
    count: saved.length,
    cases: saved.map((c: any) => ({ id:c.id, title:c.title, steps:deserializeSteps(c.stepsJson), expected:c.expected, priority:c.priority as any, type:c.type ?? "functional", order:c.order })),
  });
} catch (error: any) {
  log.error('Unhandled error in draft API', error instanceof Error ? error : new Error(String(error)), { module: 'GeneratorDraft' });
  return NextResponse.json({
    ok: false,
    error: 'INTERNAL_ERROR',
    message: error.message || 'An unexpected error occurred'
  }, { status: 500 });
}
}

function dedupeByTitle(arr: Array<{ title: string; [k:string]: any }>) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const c of arr) {
    const k = c.title.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}