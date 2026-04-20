/**
 * Retry helper for Jira / Atlassian REST calls.
 *
 * Retries on transient failures only:
 *   - HTTP 429 (Too Many Requests) — honors Retry-After header
 *   - HTTP 502, 503, 504 (transient server errors)
 *   - Network errors (fetch throws)
 *
 * Does NOT retry on:
 *   - 4xx other than 429 (caller bug, won't get better)
 *   - 5xx other than the listed ones (likely a real outage; let it surface fast)
 */

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10_000;

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Called once per retry (not on the first attempt or after success). */
  onRetry?: (info: { attempt: number; delayMs: number; reason: string }) => void;
};

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

/**
 * Parse a Retry-After header. Supports both seconds (integer) and HTTP date.
 * Returns delay in ms, or null if header is missing/unparseable.
 */
export function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function computeBackoffMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  // Exponential: base * 3^(attempt-1), with ±20% jitter
  const exp = baseDelayMs * Math.pow(3, attempt - 1);
  const capped = Math.min(exp, maxDelayMs);
  const jitter = capped * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an async fetch operation with bounded retries on transient failures.
 *
 * The operation should perform a single fetch and return the Response. The
 * caller decides what to do with the final Response (we do not consume the
 * body here, so the caller can read it). If all retries are exhausted, the
 * last Response is returned (or the last error rethrown for network errors).
 */
export async function fetchWithRetry(
  doFetch: () => Promise<Response>,
  opts: RetryOptions = {},
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelay = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelay = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastError: unknown;
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await doFetch();
      if (res.ok || !isRetryableStatus(res.status)) {
        return res;
      }
      lastResponse = res;
      if (attempt === maxAttempts) {
        return res;
      }
      const retryAfterMs =
        res.status === 429 ? parseRetryAfterMs(res.headers.get("retry-after")) : null;
      const delayMs = Math.min(
        retryAfterMs ?? computeBackoffMs(attempt, baseDelay, maxDelay),
        maxDelay,
      );
      opts.onRetry?.({ attempt, delayMs, reason: `HTTP ${res.status}` });
      await sleep(delayMs);
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) {
        if (lastResponse) return lastResponse;
        throw err;
      }
      const delayMs = computeBackoffMs(attempt, baseDelay, maxDelay);
      opts.onRetry?.({
        attempt,
        delayMs,
        reason: `network: ${err instanceof Error ? err.message : String(err)}`,
      });
      await sleep(delayMs);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError ?? new Error("fetchWithRetry exhausted attempts without a response");
}
