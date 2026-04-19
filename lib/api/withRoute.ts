import { NextResponse } from "next/server";
import type { ZodSchema, ZodError } from "zod";
import { apiError } from "@/lib/api/response";
import { assertValidCsrf } from "@/lib/security/csrf";
import { requireUserId } from "@/lib/auth/iron";

/**
 * Higher-order wrapper for App Router route handlers.
 *
 * Centralizes the four things every protected mutating route was
 * re-implementing inline:
 *   1. CSRF assertion (skipped for GET/HEAD)
 *   2. Authentication (`requireUserId` from iron-session)
 *   3. JSON body parsing + Zod validation
 *   4. Uniform error envelope (4xx for client problems, 500 for unhandled)
 *
 * The handler receives a fully-typed context with userId, the parsed
 * body (if a schema was provided), and the original Request. Throwing
 * an Error inside is caught and rendered as a 500 with the message; for
 * a controlled error use `apiError(...)` and return it directly.
 *
 * Example:
 *
 *   export const POST = withRoute({
 *     auth: true,
 *     csrf: true,
 *     body: z.object({ issueKey: z.string() }),
 *   }, async ({ userId, body }) => {
 *     const suite = await prisma.testSuite.findFirst({ where: { userId, issueKey: body.issueKey } });
 *     return apiOk({ suite });
 *   });
 *
 * NOTE: `auth: false` is intentional — opting out is explicit. Same for
 * `csrf: false`. We never silently skip security defaults.
 */

type WithRouteOptions<TBody> = {
  auth?: boolean;
  csrf?: boolean;
  body?: ZodSchema<TBody>;
};

type RouteContext<TBody> = {
  req: Request;
  userId: string | null;
  body: TBody;
};

type RouteHandler<TBody> = (ctx: RouteContext<TBody>) => Promise<NextResponse | Response>;

export function withRoute<TBody = unknown>(
  options: WithRouteOptions<TBody>,
  handler: RouteHandler<TBody>,
) {
  return async (req: Request): Promise<NextResponse | Response> => {
    try {
      const isMutation = req.method !== "GET" && req.method !== "HEAD";

      if (options.csrf && isMutation) {
        try {
          assertValidCsrf();
        } catch {
          return apiError("CSRF_INVALID", 403, {
            message: "Invalid or missing CSRF token.",
          });
        }
      }

      let userId: string | null = null;
      if (options.auth) {
        try {
          userId = await requireUserId();
        } catch {
          return apiError("AUTH_REQUIRED", 401, {
            message: "Authentication required.",
          });
        }
      }

      let body: TBody = undefined as unknown as TBody;
      if (options.body && isMutation) {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          return apiError("INVALID_JSON", 400, {
            message: "Request body must be valid JSON.",
          });
        }
        const parsed = options.body.safeParse(raw);
        if (!parsed.success) {
          return apiError("VALIDATION_FAILED", 400, {
            message: "Request body did not match expected schema.",
            details: formatZodError(parsed.error),
          });
        }
        body = parsed.data;
      }

      return await handler({ req, userId, body });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[withRoute] unhandled error", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return apiError("INTERNAL_ERROR", 500, { message });
    }
  };
}

function formatZodError(err: ZodError): Array<{ path: string; message: string }> {
  return err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
