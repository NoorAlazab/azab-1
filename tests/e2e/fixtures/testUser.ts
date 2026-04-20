/**
 * Canonical test credentials for end-to-end specs.
 *
 * These point at a fixed local demo user. To run specs against a real
 * environment, override both via env vars (CI does this):
 *
 *   E2E_USER_EMAIL=alice@example.com E2E_USER_PASSWORD=s3cret playwright test
 */
export const testUser = {
  email: process.env.E2E_USER_EMAIL ?? "demo@qa-caseforge.local",
  password: process.env.E2E_USER_PASSWORD ?? "Demo1234!",
  name: process.env.E2E_USER_NAME ?? "Demo User",
} as const;

export type TestUser = typeof testUser;
