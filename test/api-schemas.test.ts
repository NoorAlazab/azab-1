import { describe, it, expect } from "vitest";
import {
  generatorDraftSchema,
  generatorSuiteUpsertSchema,
  issueKeySchema,
  loginSchema,
  signupSchema,
  testCaseInputSchema,
} from "@/lib/shared/api/schemas";

describe("api/schemas — issueKeySchema", () => {
  it.each([["ABC-1"], ["FOO-9999"], ["A1-1"], ["MY_PROJ-42"]])(
    "accepts %s",
    (key) => {
      expect(issueKeySchema.safeParse(key).success).toBe(true);
    },
  );

  it.each([["abc-1"], ["ABC1"], ["-1"], ["ABC-"], ["ABC-1.1"], [""]])(
    "rejects %s",
    (key) => {
      expect(issueKeySchema.safeParse(key).success).toBe(false);
    },
  );
});

describe("api/schemas — testCaseInputSchema", () => {
  it("accepts a minimal valid case", () => {
    const result = testCaseInputSchema.safeParse({
      title: "User can log in",
      steps: [{ action: "Open /login" }],
      expected: "User reaches dashboard",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty steps", () => {
    const result = testCaseInputSchema.safeParse({
      title: "x",
      steps: [],
      expected: "y",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid priority", () => {
    const result = testCaseInputSchema.safeParse({
      title: "x",
      steps: [{ action: "y" }],
      expected: "z",
      priority: "URGENT",
    });
    expect(result.success).toBe(false);
  });
});

describe("api/schemas — generatorDraftSchema", () => {
  it("requires a story summary", () => {
    const result = generatorDraftSchema.safeParse({
      story: { summary: "" },
    });
    expect(result.success).toBe(false);
  });

  it("defaults mode to overwrite", () => {
    const result = generatorDraftSchema.parse({
      story: { summary: "As a user I want to log in" },
    });
    expect(result.mode).toBe("overwrite");
  });

  it("accepts a full payload with provided cases", () => {
    const result = generatorDraftSchema.safeParse({
      issueKey: "ABC-1",
      cloudId: "cloud-x",
      story: {
        summary: "Add 2FA",
        descriptionText: "Some description",
        acceptanceCriteriaText: "Given X When Y Then Z",
      },
      mode: "append",
      coverage: "functional",
      maxCases: 3,
      cases: [
        {
          title: "Happy path",
          steps: [{ action: "Open page" }],
          expected: "Page loads",
          type: "functional",
          priority: "P1",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("api/schemas — generatorSuiteUpsertSchema", () => {
  it("requires both issueKey and cloudId", () => {
    expect(generatorSuiteUpsertSchema.safeParse({}).success).toBe(false);
    expect(
      generatorSuiteUpsertSchema.safeParse({ issueKey: "ABC-1" }).success,
    ).toBe(false);
    expect(
      generatorSuiteUpsertSchema.safeParse({
        issueKey: "ABC-1",
        cloudId: "cloud",
      }).success,
    ).toBe(true);
  });
});

describe("api/schemas — loginSchema", () => {
  it("accepts a valid login body", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects bad email", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "x" }).success,
    ).toBe(false);
  });
});

describe("api/schemas — signupSchema", () => {
  it("requires password >= 8 chars", () => {
    expect(
      signupSchema.safeParse({ email: "a@b.com", password: "short" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ email: "a@b.com", password: "longenough" })
        .success,
    ).toBe(true);
  });
});
