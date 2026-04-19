# API helpers

Canonical building blocks for Next.js App Router route handlers in this
project. New routes SHOULD use these. Existing routes can adopt the
pattern incrementally — see `app/api/generator/draft/route.ts` for a
worked example.

## What's here

| File           | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| `response.ts`  | `apiOk` / `apiError` — uniform JSON envelope                 |
| `withRoute.ts` | HOF that adds CSRF + auth + Zod-validated body + error catch |
| `schemas.ts`   | Shared Zod schemas (issue keys, test cases, login, etc.)     |

## The envelope

```ts
// success
{ ok: true, data?: T }

// failure
{ ok: false, error: "STABLE_CODE", message?: "human readable", details?: unknown }
```

`error` is a stable machine code (e.g. `"VALIDATION_FAILED"`,
`"AUTH_REQUIRED"`); `message` is a user-friendly string; `details` is
free-form (Zod issues, Jira API echoes, etc).

A few legacy routes still return ad-hoc shapes (e.g. flat
`{ ok: true, suiteId, count, cases }`) because the dashboard depends on
them. Those should be migrated client-and-server together; do NOT change
the shape unilaterally.

## Pattern: a new POST route

```ts
import { withRoute } from "@/lib/api/withRoute";
import { apiOk, apiError } from "@/lib/api/response";
import { z } from "zod";

const bodySchema = z.object({
  issueKey: z.string().regex(/^[A-Z]+-\d+$/),
});

export const POST = withRoute(
  { auth: true, csrf: true, body: bodySchema },
  async ({ userId, body }) => {
    const found = await prisma.something.findFirst({
      where: { userId: userId!, issueKey: body.issueKey },
    });
    if (!found) return apiError("NOT_FOUND", 404);
    return apiOk({ id: found.id });
  },
);
```

## Pattern: a public GET (no auth, no CSRF)

```ts
export const GET = withRoute({ auth: false, csrf: false }, async () => {
  return apiOk({ ping: "pong" });
});
```

## Why a HOF instead of middleware

Next.js middleware runs on the Edge runtime, where Prisma + iron-session
do not work. `withRoute` runs in the same Node process as your handler,
which is the only place we can do real auth.

## Failure modes the wrapper handles for you

| Situation                  | Response                                              |
| -------------------------- | ----------------------------------------------------- |
| Missing/invalid CSRF       | `403 { ok:false, error:"CSRF_INVALID" }`              |
| `auth:true` but no session | `401 { ok:false, error:"AUTH_REQUIRED" }`             |
| Body is not valid JSON     | `400 { ok:false, error:"INVALID_JSON" }`              |
| Body fails Zod validation  | `400 { ok:false, error:"VALIDATION_FAILED", details}` |
| Handler throws             | `500 { ok:false, error:"INTERNAL_ERROR", message }`   |
