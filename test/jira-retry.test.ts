import { describe, it, expect, vi } from "vitest";
import {
  fetchWithRetry,
  isRetryableStatus,
  parseRetryAfterMs,
} from "@/lib/jira/retry";

function jsonResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ status }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("jira/retry — isRetryableStatus", () => {
  it("treats 429 and 5xx transient codes as retryable", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
  });

  it("does not retry on 4xx (except 429) or non-transient 5xx", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(500)).toBe(false);
    expect(isRetryableStatus(501)).toBe(false);
  });
});

describe("jira/retry — parseRetryAfterMs", () => {
  it("returns null for missing header", () => {
    expect(parseRetryAfterMs(null)).toBeNull();
  });

  it("parses integer seconds", () => {
    expect(parseRetryAfterMs("3")).toBe(3000);
    expect(parseRetryAfterMs("0")).toBe(0);
  });

  it("parses HTTP-date and returns positive delta", () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThan(0);
    expect(ms!).toBeLessThanOrEqual(5000);
  });

  it("clamps past HTTP-date to 0", () => {
    const past = new Date(Date.now() - 5000).toUTCString();
    expect(parseRetryAfterMs(past)).toBe(0);
  });

  it("returns null for unparseable header", () => {
    expect(parseRetryAfterMs("not-a-date")).toBeNull();
  });
});

describe("jira/retry — fetchWithRetry", () => {
  it("returns immediately on a successful response without retrying", async () => {
    const doFetch = vi.fn().mockResolvedValue(jsonResponse(200));
    const onRetry = vi.fn();
    const res = await fetchWithRetry(doFetch, { onRetry });
    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("does not retry on non-transient 4xx", async () => {
    const doFetch = vi.fn().mockResolvedValue(jsonResponse(404));
    const res = await fetchWithRetry(doFetch);
    expect(res.status).toBe(404);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and eventually succeeds", async () => {
    const doFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200));
    const onRetry = vi.fn();
    const res = await fetchWithRetry(doFetch, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      onRetry,
    });
    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("returns the last response when all attempts fail with retryable status", async () => {
    const doFetch = vi.fn().mockResolvedValue(jsonResponse(429));
    const res = await fetchWithRetry(doFetch, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
    });
    expect(res.status).toBe(429);
    expect(doFetch).toHaveBeenCalledTimes(3);
  });

  it("retries on network errors and rethrows after exhaustion", async () => {
    const err = new Error("ECONNRESET");
    const doFetch = vi.fn().mockRejectedValue(err);
    await expect(
      fetchWithRetry(doFetch, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5 }),
    ).rejects.toThrow("ECONNRESET");
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After on 429 (capped at maxDelayMs)", async () => {
    const doFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { "retry-after": "1" }))
      .mockResolvedValueOnce(jsonResponse(200));
    const onRetry = vi.fn();
    const res = await fetchWithRetry(doFetch, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      onRetry,
    });
    expect(res.status).toBe(200);
    expect(onRetry).toHaveBeenCalledTimes(1);
    const call = onRetry.mock.calls[0][0] as { delayMs: number };
    // capped to maxDelayMs (5) even though Retry-After said 1000ms
    expect(call.delayMs).toBeLessThanOrEqual(5);
  });
});
