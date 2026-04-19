import argon2 from "argon2";

/**
 * Pinned argon2id parameters.
 *
 * Aligned with the OWASP Password Storage Cheat Sheet recommendation for
 * argon2id (memoryCost=19 MiB, timeCost=2, parallelism=1). These parameters
 * are intentionally explicit so that:
 *   1. Future bumps to library defaults do not silently change behavior.
 *   2. New deployments produce hashes with predictable cost.
 *
 * Existing hashes encode their own parameters in the hash string, so this
 * pinning only affects NEW hashes (signup, password change). Verifying an
 * older hash continues to work.
 */
export const ARGON2_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Lazily-generated dummy argon2id hash used for the "user not found" branch
 * in the login route. Verifying against this in the no-user case takes
 * roughly the same wall-clock time as a real password check, mitigating
 * the timing oracle that would otherwise let an attacker enumerate
 * registered emails.
 *
 * Generated on first call so we never bake a specific hash into source
 * (which would be a foot-gun if the algorithm parameters change).
 */
let cachedDummyHash: string | null = null;
export async function getDummyHashForTimingMitigation(): Promise<string> {
  if (cachedDummyHash) return cachedDummyHash;
  cachedDummyHash = await argon2.hash(
    "qa-caseforge::timing-mitigation::dummy",
    ARGON2_HASH_OPTIONS,
  );
  return cachedDummyHash;
}
