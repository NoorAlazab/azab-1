/**
 * Unified rate-limiting abstraction.
 *
 * Why not just `@upstash/ratelimit` directly?
 *   - We want the same code to run in local dev (no Redis), in tests
 *     (no network), and in production (multi-instance) without
 *     conditional imports scattered through routes.
 *   - The contract here intentionally mirrors Upstash's so swapping
 *     adapters is a one-line change.
 *
 * Backend selection (chosen ONCE at module init):
 *   - If both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 *     are present, we use a sliding-window limiter on Upstash.
 *     This is the only configuration that is correct under
 *     horizontal scaling.
 *   - Otherwise we fall back to an in-process token bucket. This is
 *     fine for local development and CI; it is NOT correct across
 *     multiple Node instances (each instance has its own bucket).
 *     A loud one-time warning is printed in production if we end up
 *     on the in-memory backend so an operator notices.
 *
 * Identity:
 *   - For authenticated routes, prefer userId.
 *   - For anonymous routes (login, signup, magic-link), use IP.
 *   - The `getIdentifier` helper composes these consistently.
 */

import type { NextRequest } from "next/server";

export type RateLimitResult = {
  /** True when the request is permitted. */
  success: boolean;
  /** Total tokens allotted in the current window. */
  limit: number;
  /** Tokens remaining after this request (>= 0). */
  remaining: number;
  /** Epoch ms at which the window resets. */
  reset: number;
};

export type RateLimiter = {
  /** Consume one token for `identifier`. */
  limit(identifier: string): Promise<RateLimitResult>;
};

type LimiterConfig = {
  /** Max requests per window. */
  requests: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Stable name (used as a cache key prefix in Redis). */
  name: string;
};

// ---------------------------------------------------------------------------
// In-memory token bucket (dev/test fallback)
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };

class MemoryLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(private cfg: LimiterConfig) {}

  async limit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.cfg.name}:${identifier}`;
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.cfg.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    const allowed = bucket.count <= this.cfg.requests;
    const remaining = Math.max(0, this.cfg.requests - bucket.count);

    // Opportunistic GC so the map does not grow without bound under abuse.
    if (this.buckets.size > 5000) {
      for (const [k, v] of this.buckets) {
        if (v.resetAt <= now) this.buckets.delete(k);
      }
    }

    return {
      success: allowed,
      limit: this.cfg.requests,
      remaining,
      reset: bucket.resetAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Upstash adapter (lazy-loaded so dev does not pay the import cost)
// ---------------------------------------------------------------------------

type UpstashRatelimitCtor = new (opts: {
  redis: unknown;
  limiter: unknown;
  prefix?: string;
  analytics?: boolean;
}) => {
  limit: (id: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
};

type UpstashInstance = InstanceType<UpstashRatelimitCtor>;

class UpstashLimiter implements RateLimiter {
  private inner: UpstashInstance;

  constructor(cfg: LimiterConfig) {
    // Synchronous require keeps the constructor non-async; the modules
    // are tiny and only loaded when env vars are set.
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
    const { Ratelimit } = require("@upstash/ratelimit") as {
      Ratelimit: UpstashRatelimitCtor & {
        slidingWindow: (n: number, w: string) => unknown;
      };
    };
    const { Redis } = require("@upstash/redis") as {
      Redis: new (opts: { url: string; token: string }) => unknown;
    };
    /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const windowSeconds = Math.max(1, Math.round(cfg.windowMs / 1000));
    this.inner = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.requests, `${windowSeconds} s`),
      prefix: `rl:${cfg.name}`,
      analytics: false,
    });
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const r = await this.inner.limit(identifier);
    return {
      success: r.success,
      limit: r.limit,
      remaining: r.remaining,
      reset: r.reset,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory + presets
// ---------------------------------------------------------------------------

let warned = false;
function makeLimiter(cfg: LimiterConfig): RateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      return new UpstashLimiter(cfg);
    } catch (err) {
      // Fall through to memory; surface the issue once.
      if (!warned) {
        warned = true;
        // eslint-disable-next-line no-console
        console.warn(
          "[rateLimit] Upstash configured but failed to initialize, falling back to in-memory:",
          err,
        );
      }
    }
  } else if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[rateLimit] Running in production without Upstash credentials. " +
        "Rate limits are per-instance only and will NOT protect across replicas. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to fix.",
    );
  }
  return new MemoryLimiter(cfg);
}

// Memoize so repeated `getLimiter("auth")` calls share state.
const cache = new Map<string, RateLimiter>();
function getOrMake(cfg: LimiterConfig): RateLimiter {
  const existing = cache.get(cfg.name);
  if (existing) return existing;
  const created = makeLimiter(cfg);
  cache.set(cfg.name, created);
  return created;
}

/**
 * Named presets used across the app. Add more here rather than inlining
 * magic numbers so we have one place to tune limits.
 */
export const Limiters = {
  /** Login / signup / magic-link / verify — strict, per IP. */
  auth: () =>
    getOrMake({ name: "auth", requests: 10, windowMs: 60_000 }),
  /** AI generation (draft, stream) — moderate, per user. */
  aiGenerate: () =>
    getOrMake({ name: "aiGenerate", requests: 20, windowMs: 60_000 }),
  /** Jira write / publish operations — moderate, per user. */
  jiraWrite: () =>
    getOrMake({ name: "jiraWrite", requests: 30, windowMs: 60_000 }),
  /** Catch-all per-user limit applied by withRoute when enabled. */
  general: () =>
    getOrMake({ name: "general", requests: 240, windowMs: 60_000 }),
};

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort client IP. Trusts the standard Vercel / proxy headers;
 * falls back to "unknown" so we never throw on missing infra.
 */
export function getClientIp(req: Request | NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Build a stable identifier for a request: prefer userId for
 * authenticated traffic, fall back to client IP for anonymous traffic.
 */
export function getIdentifier(
  req: Request | NextRequest,
  userId?: string | null,
): string {
  if (userId) return `u:${userId}`;
  return `ip:${getClientIp(req)}`;
}

/**
 * Convert a RateLimitResult into the standard X-RateLimit-* headers.
 * Useful for clients that want to display "you have N requests left".
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
  };
}

/**
 * One-line guard for legacy routes that aren't using `withRoute`.
 *
 * Usage:
 *   const blocked = await enforceRateLimit(req, Limiters.auth());
 *   if (blocked) return blocked;
 *
 * Returns a 429 Response when the request should be rejected, or
 * null when the caller should proceed. This keeps rate-limit logic
 * out of the happy path and makes the integration trivially obvious
 * in code review.
 */
export async function enforceRateLimit(
  req: Request | NextRequest,
  limiter: RateLimiter,
  userId?: string | null,
): Promise<Response | null> {
  const id = getIdentifier(req, userId);
  const result = await limiter.limit(id);
  if (result.success) return null;
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      ok: false,
      error: "RATE_LIMITED",
      message: "Too many requests. Please slow down.",
      details: { retryAfterSeconds: retryAfter },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        ...rateLimitHeaders(result),
      },
    },
  );
}
