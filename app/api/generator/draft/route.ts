export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateCasesAI } from "@/lib/ai/generateCases";
import { deserializeSteps, serializeSteps } from "@/lib/generator/stepsJson";
import { log } from "@/lib/utils/logger";
import { withRoute } from "@/lib/api/withRoute";
import { apiError } from "@/lib/api/response";
import { generatorDraftSchema } from "@/lib/api/schemas";

/**
 * POST /api/generator/draft
 *
 * Generates (or accepts) test cases and persists them to a TestSuite.
 *
 * NOTE on response shape: the frontend dashboard reads `suiteId`, `mode`,
 * `count`, and `cases` directly off the top of the response body. We keep
 * that legacy shape here (with `ok: true` for sniffing) instead of nesting
 * under `data` to avoid a coordinated client/server change. Errors,
 * however, use the canonical `apiError` envelope.
 */

export const POST = withRoute(
  { auth: true, csrf: true, body: generatorDraftSchema },
  async ({ userId, body }) => {
    if (!userId) return apiError("AUTH_REQUIRED", 401);

    let { suiteId, issueKey, cloudId, story, mode, coverage, maxCases, cases } = body;

    if (!suiteId) {
      if (!issueKey || !cloudId) {
        return apiError("MISSING_FIELDS", 400, {
          message: "Either suiteId or both issueKey and cloudId are required.",
        });
      }
      const created = await prisma.testSuite.upsert({
        where: { uniq_user_issue: { userId, issueKey } },
        update: { cloudId },
        create: { userId, issueKey, cloudId },
      });
      suiteId = created.id;
    }

    const suite = await prisma.testSuite.findFirst({ where: { id: suiteId, userId } });
    if (!suite) return apiError("SUITE_NOT_FOUND", 404);

    let out: Array<{
      title: string;
      steps: Array<{ action: string; expected?: string }>;
      expected: string;
      priority?: string | null;
      type?: string;
    }>;

    if (cases && cases.length > 0) {
      log.debug("Using provided manual test cases", {
        module: "GeneratorDraft",
        count: cases.length,
        mode,
      });
      out = cases as typeof out;
    } else {
      log.ai("groq", "llama-3.1-8b-instant", {
        module: "GeneratorDraft",
        summary: story.summary.substring(0, 50) + "...",
        hasDescription: !!story.descriptionText,
        hasAC: !!story.acceptanceCriteriaText,
        coverage: coverage ?? "functional",
        maxCases: maxCases ?? 3,
      });

      out = await generateCasesAI({
        summary: story.summary,
        description: story.descriptionText ?? "",
        ac: story.acceptanceCriteriaText ?? "",
        coverage: coverage ?? "functional",
        maxCases: maxCases ?? 3,
      });

      log.debug("AI generation completed", { module: "GeneratorDraft", count: out.length });
    }

    const existing = await prisma.testCase.findMany({
      where: { suiteId },
      orderBy: { order: "asc" },
    });

    // In "append" mode, drop any incoming case whose normalized title
    // already exists in the suite — then dedupe the remainder against
    // itself. In "overwrite" mode the existing rows are wiped below, so
    // we just dedupe the incoming batch.
    let deduped: typeof out;
    if (mode === "append") {
      const existingTitles = new Set(existing.map((x) => x.title.trim().toLowerCase()));
      const fresh = out.filter((c) => !existingTitles.has(c.title.trim().toLowerCase()));
      deduped = dedupeByTitle(fresh);
    } else {
      deduped = dedupeByTitle(out);
    }

    if (mode === "overwrite") {
      const deleted = await prisma.testCase.deleteMany({ where: { suiteId } });
      log.debug("Deleted existing cases", { module: "GeneratorDraft", count: deleted.count });
    }

    const baseOrder = mode === "append" ? existing.length : 0;
    const casesToCreate = deduped.map((c, i) => ({
      suiteId,
      title: c.title,
      stepsJson: serializeSteps(c.steps),
      expected: c.expected,
      priority: c.priority ?? null,
      type: c.type ?? "functional",
      order: baseOrder + i,
    }));

    await prisma.testCase.createMany({ data: casesToCreate });

    await prisma.testSuite.update({
      where: { id: suiteId },
      data: { status: "draft", dirty: true },
    });

    const saved = await prisma.testCase.findMany({
      where: { suiteId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({
      ok: true,
      suiteId,
      mode: mode ?? "overwrite",
      count: saved.length,
      cases: saved.map((c) => ({
        id: c.id,
        title: c.title,
        steps: deserializeSteps(c.stepsJson),
        expected: c.expected,
        priority: c.priority,
        type: c.type ?? "functional",
        order: c.order,
      })),
    });
  },
);

function dedupeByTitle<T extends { title: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of arr) {
    const k = c.title.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
