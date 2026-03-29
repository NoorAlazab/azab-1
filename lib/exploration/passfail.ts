import type { CTACandidate } from "./locators";
import { findMatchingCandidates, pickPrimaryCTA } from "./locators";

export interface LabelChangeResult {
  pass: boolean;
  hasTarget: boolean;
  hasLegacyPrimary: boolean;
  primaryName: string | null;
  primaryNormalized: string | null;
  targetMatches: CTACandidate[];
  legacyMatches: CTACandidate[];
  reason: string;
}

/**
 * Decide pass/fail for label change objective
 *
 * PASS criteria:
 * - A visible, clickable element's accessible name matches target AND
 * - The primary CTA does not match any legacy terms
 *
 * FAIL criteria:
 * - Primary CTA matches legacy terms (e.g., "Sign in" still present)
 * - Target not found at all
 * - Both target and legacy primary exist
 * - No CTA candidates found
 */
export function decideLabelChange(input: {
  candidates: CTACandidate[];
  fromTerms: string[];
  toTerms: string[];
}): LabelChangeResult {
  const { candidates, fromTerms, toTerms } = input;

  // Check if we have any candidates at all
  if (candidates.length === 0) {
    return {
      pass: false,
      hasTarget: false,
      hasLegacyPrimary: false,
      primaryName: null,
      primaryNormalized: null,
      targetMatches: [],
      legacyMatches: [],
      reason: "No CTA candidates found on page",
    };
  }

  // Find candidates matching target and legacy terms
  const targetMatches = findMatchingCandidates(candidates, toTerms);
  const legacyMatches = findMatchingCandidates(candidates, fromTerms);

  const hasTarget = targetMatches.length > 0;
  const hasLegacy = legacyMatches.length > 0;

  // Pick the primary CTA
  const primaryCTA = pickPrimaryCTA(candidates);
  const primaryName = primaryCTA?.name || null;
  const primaryNormalized = primaryCTA?.normalizedName || null;

  // Check if primary CTA matches legacy terms
  const primaryMatchesLegacy = primaryCTA
    ? fromTerms.some((term) => term.toLowerCase() === primaryNormalized?.toLowerCase())
    : false;

  console.log("[PassFail] Label change decision:", {
    hasTarget,
    hasLegacy,
    primaryName,
    primaryNormalized,
    primaryMatchesLegacy,
    targetCount: targetMatches.length,
    legacyCount: legacyMatches.length,
  });

  // PASS: Target exists AND primary CTA does not match legacy
  if (hasTarget && !primaryMatchesLegacy) {
    return {
      pass: true,
      hasTarget: true,
      hasLegacyPrimary: false,
      primaryName,
      primaryNormalized,
      targetMatches,
      legacyMatches,
      reason: `Target text "${toTerms[0]}" found and primary CTA updated`,
    };
  }

  // FAIL: Primary CTA still shows legacy text
  if (primaryMatchesLegacy) {
    return {
      pass: false,
      hasTarget,
      hasLegacyPrimary: true,
      primaryName,
      primaryNormalized,
      targetMatches,
      legacyMatches,
      reason: `Primary CTA still shows legacy text "${primaryName}" instead of "${toTerms[0]}"`,
    };
  }

  // FAIL: Target not found
  if (!hasTarget) {
    return {
      pass: false,
      hasTarget: false,
      hasLegacyPrimary: hasLegacy,
      primaryName,
      primaryNormalized,
      targetMatches,
      legacyMatches,
      reason: `Target text "${toTerms[0]}" not found on page`,
    };
  }

  // FAIL: Fallback (shouldn't reach here, but handle edge cases)
  return {
    pass: false,
    hasTarget,
    hasLegacyPrimary: hasLegacy,
    primaryName,
    primaryNormalized,
    targetMatches,
    legacyMatches,
    reason: "Label change verification failed (unexpected state)",
  };
}
