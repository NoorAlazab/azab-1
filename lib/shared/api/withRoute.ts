import { NextResponse } from "next/server";
import type { ZodSchema, ZodError } from "zod";
import { apiError } from "@/lib/shared/api/response";
import { assertValidCsrf } from "@/lib/server/security/csrf";
import { requireUserId } from "@/lib/server/auth/iron";
import {
  getIdentifier,
  rateLimitHeaders,
  type RateLimiter,
} from "@/lib/server/security/rateLimit";

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
  /**
   * Optional rate limiter. The route is rejected with 429 if the
   * request exceeds the limit. Identifier is the userId when
   * available, otherwise the client IP. Standard X-RateLimit-*
   * headers are added to ALL responses (allowed + rejected) so
   * clients can self-throttle.
   */
  rateLimit?: RateLimiter | (() => RateLimiter);
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

      // Rate limit check happens AFTER auth so we can identify by
      // userId, but BEFORE body parsing so we never spend cycles
      // validating bodies for rejected callers.
      let rateLimitResponseHeaders: Record<string, string> | null = null;
      if (options.rateLimit) {
        const limiter =
          typeof options.rateLimit === "function"
            ? options.rateLimit()
            : options.rateLimit;
        const id = getIdentifier(req, userId);
        const result = await limiter.limit(id);
        rateLimitResponseHeaders = rateLimitHeaders(result);
        if (!result.success) {
          const retryAfter = Math.max(
            1,
            Math.ceil((result.reset - Date.now()) / 1000),
          );
          const rejected = apiError("RATE_LIMITED", 429, {
            message: "Too many requests. Please slow down.",
            details: { retryAfterSeconds: retryAfter },
          });
          rejected.headers.set("Retry-After", String(retryAfter));
          for (const [k, v] of Object.entries(rateLimitResponseHeaders)) {
            rejected.headers.set(k, v);
          }
          return rejected;
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

      const response = await handler({ req, userId, body });
      if (rateLimitResponseHeaders && response instanceof Response) {
        for (const [k, v] of Object.entries(rateLimitResponseHeaders)) {
          response.headers.set(k, v);
        }
      }
      return response;
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
