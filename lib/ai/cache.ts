import { createHash } from "node:crypto";

/**
 * In-memory TTL cache for AI generation results.
 *
 * The same story summary + AC + coverage type combination produces the
 * same answer ~95% of the time within a session, and the Groq round trip
 * is a 2-5s blocker for the user. Hitting the cache makes the second
 * "regenerate" feel instant.
 *
 * NOTE: this is a per-process cache. In a horizontally-scaled deployment
 * each Node instance keeps its own copy, which is fine because the
 * downside is only "cache miss occasionally". When Upstash Redis is wired
 * in (Phase G), swap the implementation here without changing callers.
 *
 * Eviction strategy:
 *   - Time-based: each entry expires after `ttlMs` (default 30 minutes).
 *   - Size-based: when `maxEntries` is exceeded, oldest entries are
 *     evicted (insertion-order, not LRU — Map iteration order gives us
 *     this for free).
 */

type Entry<V> = {
  value: V;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 200;

export class TTLCache<V> {
  private readonly store = new Map<string, Entry<V>>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly maxEntries: number = DEFAULT_MAX_ENTRIES,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

/**
 * Stable hash for cache keys. Using SHA-256 truncated to 16 hex chars (64
 * bits) keeps keys short while making accidental collisions astronomically
 * unlikely for our cache size.
 */
export function hashKey(parts: Array<string | number | null | undefined>): string {
  const normalized = parts.map((p) => (p == null ? "" : String(p))).join("|");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export const generateCasesCache = new TTLCache<unknown>();
