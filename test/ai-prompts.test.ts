import { describe, it, expect } from "vitest";
import {
  buildGenerateCasesPrompt,
  buildSelectorContext,
} from "@/lib/server/ai/prompts/generateCases";

describe("ai/prompts — buildGenerateCasesPrompt", () => {
  const base = {
    summary: "User can reset their password",
    description: "Allow users to reset password via email link",
    ac: "Email is sent within 30s",
    coverageTypes: ["functional"],
    maxCases: 5,
  };

  it("interpolates summary, description, and AC", () => {
    const p = buildGenerateCasesPrompt(base);
    expect(p).toContain("User can reset their password");
    expect(p).toContain("Allow users to reset password via email link");
    expect(p).toContain("Email is sent within 30s");
  });

  it("requests exactly maxCases test cases", () => {
    const p = buildGenerateCasesPrompt({ ...base, maxCases: 7 });
    expect(p).toContain("exactly 7 detailed");
    expect(p).toContain("EXACTLY 7 TEST CASES");
  });

  it("emits the functional-only block when only functional is selected", () => {
    const p = buildGenerateCasesPrompt({ ...base, coverageTypes: ["functional"] });
    expect(p).toContain("FUNCTIONAL TESTS ONLY");
    expect(p).not.toContain("NEGATIVE TESTS ONLY");
    expect(p).not.toContain("SECURITY TESTS ONLY");
  });

  it("emits the negative+security blocks when both are selected", () => {
    const p = buildGenerateCasesPrompt({
      ...base,
      coverageTypes: ["negative", "security"],
    });
    expect(p).toContain("NEGATIVE TESTS ONLY");
    expect(p).toContain("SECURITY TESTS ONLY");
    expect(p).not.toContain("FUNCTIONAL TESTS ONLY");
  });

  it("falls back to friendly placeholders when description/ac are missing", () => {
    const p = buildGenerateCasesPrompt({
      ...base,
      description: undefined,
      ac: undefined,
    });
    expect(p).toContain("No description provided");
    expect(p).toContain("No acceptance criteria provided");
  });

  it("includes provided selectorContext block verbatim", () => {
    const p = buildGenerateCasesPrompt({
      ...base,
      selectorContext: "\n\nINJECTED_SELECTOR_BLOCK\n",
    });
    expect(p).toContain("INJECTED_SELECTOR_BLOCK");
  });
});

describe("ai/prompts — buildSelectorContext", () => {
  it("returns empty string when no elements are provided", () => {
    expect(buildSelectorContext("login", {})).toBe("");
  });

  it("renders a backticked, descriptive list of element keys", () => {
    const ctx = buildSelectorContext("login", {
      buttonSignin: { metadata: { description: "Primary sign-in button" } },
      inputEmail: {},
    });
    expect(ctx).toContain("LOGIN PAGE");
    expect(ctx).toContain("`buttonSignin`");
    expect(ctx).toContain("Primary sign-in button");
    expect(ctx).toContain("`inputEmail`");
    expect(ctx).toContain("no description");
  });
});
