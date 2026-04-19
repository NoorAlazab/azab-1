/**
 * Helpers for the `stepsJson` column on `TestCase` and `BugFinding`.
 *
 * The Prisma schema declares `stepsJson Json` (a native JSON column), but
 * historically the application stored a JSON-encoded *string* in it
 * (calling JSON.stringify on the write side and JSON.parse on the read
 * side). That double-encoded the payload, prevented native JSON queries,
 * and made the type signature dishonest.
 *
 * Going forward writers should pass the native value (array/object) and
 * Prisma will serialize it correctly. Readers go through the tolerant
 * `deserializeSteps` here so that pre-existing rows that still hold a
 * JSON-encoded string are auto-parsed on read.
 *
 * NOTE: A backfill migration to rewrite the old rows to native JSON is a
 * separate task; this helper is the safe intermediate step.
 */

export type Step = {
  action?: string;
  expected?: string;
  [key: string]: unknown;
};

export function serializeSteps(steps: Step[] | unknown): unknown {
  return steps;
}

export function deserializeSteps(stepsJson: unknown): Step[] {
  if (stepsJson == null) return [];
  if (typeof stepsJson === "string") {
    try {
      const parsed = JSON.parse(stepsJson);
      return Array.isArray(parsed) ? (parsed as Step[]) : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(stepsJson)) return stepsJson as Step[];
  return [];
}
