import { describe, it, expect } from "vitest";
import { apiOk, apiError } from "@/lib/api/response";

describe("api/response — apiOk", () => {
  it("wraps data in ok envelope and defaults to 200", async () => {
    const res = apiOk({ x: 1 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { x: 1 } });
  });

  it("works with no data payload (ack-style 200)", async () => {
    const res = apiOk();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeUndefined();
  });

  it("honors custom status init", async () => {
    const res = apiOk({ id: "abc" }, { status: 201 });
    expect(res.status).toBe(201);
  });
});

describe("api/response — apiError", () => {
  it("emits ok:false envelope with required error code and status", async () => {
    const res = apiError("VALIDATION_FAILED", 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "VALIDATION_FAILED" });
  });

  it("includes optional message and details when provided", async () => {
    const res = apiError("VALIDATION_FAILED", 400, {
      message: "Bad input",
      details: [{ path: "email", message: "Invalid email" }],
    });
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: "VALIDATION_FAILED",
      message: "Bad input",
      details: [{ path: "email", message: "Invalid email" }],
    });
  });
});
