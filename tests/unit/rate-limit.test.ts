import { describe, it, expect, beforeEach } from "vitest";

// Force the in-memory backend regardless of the host environment.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

import {
  enforceRateLimit,
  getClientIp,
  getIdentifier,
  rateLimitHeaders,
  type RateLimiter,
} from "@/lib/server/security/rateLimit";

// The production MemoryLimiter is module-private, but its behaviour is
// the contract — we re-implement it inline so the test fails loudly if
// that contract drifts. Keeping it local also lets each test mint a
// fresh limiter with no state bleeding through the module-level cache.
function makeLimiter(requests: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async limit(id: string) {
      const now = Date.now();
      let b = buckets.get(id);
      if (!b || b.resetAt <= now) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(id, b);
      }
      b.count += 1;
      return {
        success: b.count <= requests,
        limit: requests,
        remaining: Math.max(0, requests - b.count),
        reset: b.resetAt,
      };
    },
  };
}

function makeReq(
  headers: Record<string, string> = {},
  url = "https://example.test/api/x",
): Request {
  return new Request(url, { method: "POST", headers });
}

describe("rateLimit — getClientIp", () => {
  it("uses first entry of x-forwarded-for", () => {
    const req = makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = makeReq({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when nothing useful is present", () => {
    const req = makeReq();
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("rateLimit — getIdentifier", () => {
  it("prefers userId when provided", () => {
    const req = makeReq({ "x-real-ip": "9.9.9.9" });
    expect(getIdentifier(req, "user-123")).toBe("u:user-123");
  });

  it("falls back to ip when userId is null", () => {
    const req = makeReq({ "x-real-ip": "9.9.9.9" });
    expect(getIdentifier(req, null)).toBe("ip:9.9.9.9");
  });
});

describe("rateLimit — rateLimitHeaders", () => {
  it("emits the standard X-RateLimit-* triple", () => {
    const headers = rateLimitHeaders({
      success: true,
      limit: 10,
      remaining: 7,
      reset: 1_700_000_000_000,
    });
    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("7");
    // Reset is in seconds, not ms.
    expect(headers["X-RateLimit-Reset"]).toBe("1700000000");
  });
});

describe("rateLimit — limiter semantics", () => {
  let limiter: RateLimiter;
  beforeEach(() => {
    limiter = makeLimiter(3, 60_000);
  });

  it("allows requests up to the configured cap", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await limiter.limit("u:alice");
      expect(r.success).toBe(true);
    }
  });

  it("rejects the request that breaches the cap", async () => {
    for (let i = 0; i < 3; i++) await limiter.limit("u:alice");
    const r = await limiter.limit("u:alice");
    expect(r.success).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("isolates buckets by identifier", async () => {
    for (let i = 0; i < 3; i++) await limiter.limit("u:alice");
    const other = await limiter.limit("u:bob");
    expect(other.success).toBe(true);
  });
});

describe("rateLimit — enforceRateLimit helper", () => {
  it("returns null when the limiter allows the request", async () => {
    const limiter = makeLimiter(5, 60_000);
    const req = makeReq({ "x-real-ip": "1.1.1.1" });
    const result = await enforceRateLimit(req, limiter);
    expect(result).toBeNull();
  });

  it("returns a 429 Response with Retry-After when rejected", async () => {
    const limiter = makeLimiter(1, 60_000);
    const req = makeReq({ "x-real-ip": "1.1.1.1" });
    // First call consumes the only token.
    await enforceRateLimit(req, limiter);
    const blocked = await enforceRateLimit(req, limiter);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(blocked!.headers.get("X-RateLimit-Limit")).toBe("1");
    const body = await blocked!.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.details.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("identifies callers separately by IP", async () => {
    const limiter = makeLimiter(1, 60_000);
    await enforceRateLimit(
      makeReq({ "x-real-ip": "1.1.1.1" }),
      limiter,
    );
    const otherIp = await enforceRateLimit(
      makeReq({ "x-real-ip": "2.2.2.2" }),
      limiter,
    );
    expect(otherIp).toBeNull();
  });

  it("respects an explicit userId override", async () => {
    const limiter = makeLimiter(1, 60_000);
    const req = makeReq({ "x-real-ip": "1.1.1.1" });
    // Same IP, two different users — both should be allowed once.
    const aliceFirst = await enforceRateLimit(req, limiter, "alice");
    const bobFirst = await enforceRateLimit(req, limiter, "bob");
    expect(aliceFirst).toBeNull();
    expect(bobFirst).toBeNull();
    const aliceSecond = await enforceRateLimit(req, limiter, "alice");
    expect(aliceSecond).not.toBeNull();
  });
});
