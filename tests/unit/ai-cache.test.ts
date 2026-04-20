import { describe, it, expect, vi } from "vitest";
import { TTLCache, hashKey } from "@/lib/server/ai/cache";

describe("ai/cache — TTLCache", () => {
  it("stores and retrieves values", () => {
    const c = new TTLCache<number>(60_000, 10);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
  });

  it("returns undefined for missing keys", () => {
    const c = new TTLCache<number>();
    expect(c.get("missing")).toBeUndefined();
  });

  it("expires entries after the TTL", () => {
    vi.useFakeTimers();
    try {
      const c = new TTLCache<string>(1000, 10);
      c.set("a", "x");
      expect(c.get("a")).toBe("x");
      vi.advanceTimersByTime(1500);
      expect(c.get("a")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("evicts oldest entry when capacity is exceeded", () => {
    const c = new TTLCache<number>(60_000, 3);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.set("d", 4);
    expect(c.size()).toBe(3);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("d")).toBe(4);
  });

  it("supports clear()", () => {
    const c = new TTLCache<number>();
    c.set("a", 1);
    c.set("b", 2);
    c.clear();
    expect(c.size()).toBe(0);
  });

  it("supports delete()", () => {
    const c = new TTLCache<number>();
    c.set("a", 1);
    c.delete("a");
    expect(c.get("a")).toBeUndefined();
  });
});

describe("ai/cache — hashKey", () => {
  it("returns a stable 16-char hex string", () => {
    const h = hashKey(["a", "b", 1]);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic", () => {
    expect(hashKey(["a", "b", 1])).toBe(hashKey(["a", "b", 1]));
  });

  it("differs for different inputs", () => {
    expect(hashKey(["a"])).not.toBe(hashKey(["b"]));
    expect(hashKey(["a", "b"])).not.toBe(hashKey(["ab"]));
  });

  it("treats null and undefined as empty strings (consistently)", () => {
    expect(hashKey([null, "x"])).toBe(hashKey([undefined, "x"]));
    expect(hashKey([null, "x"])).toBe(hashKey(["", "x"]));
  });
});
