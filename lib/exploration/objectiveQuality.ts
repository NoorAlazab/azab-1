import type { Objective, QualityScore } from "@/types/exploration";

/**
 * Score an objective based on how concrete and testable it is
 * Returns a score from 0 to 1
 */
export function scoreObjective(objective: Objective): number {
  let score = 0;

  // +0.30 if roles are specified (indicates concrete UI elements to interact with)
  if (objective.target.roles && objective.target.roles.length > 0) {
    score += 0.30;
  }

  // +0.50 if texts/notTexts are specified (indicates specific content to verify)
  if (
    (objective.target.texts && objective.target.texts.length > 0) ||
    (objective.target.notTexts && objective.target.notTexts.length > 0)
  ) {
    score += 0.50;
  }

  // +0.15 if paths are specified (indicates specific navigation targets)
  if (objective.target.paths && objective.target.paths.length > 0) {
    score += 0.15;
  }

  // +0.05 if selectors are specified (indicates very specific element targeting)
  if (objective.target.selectors && objective.target.selectors.length > 0) {
    score += 0.05;
  }

  return Math.min(score, 1); // Cap at 1.0
}

/**
 * Get a quality label for a score
 */
export function qualityLabel(score: number): "Low" | "Medium" | "High" {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}

/**
 * Get quality score with label
 */
export function getQuality(objective: Objective): QualityScore {
  const score = scoreObjective(objective);
  const label = qualityLabel(score);
  return { score, label };
}

/**
 * Check if an objective meets minimum quality threshold
 * @param objective The objective to check
 * @param intentType The primary intent type (for special rules)
 * @returns true if objective meets quality threshold
 */
export function meetsQualityThreshold(objective: Objective, intentType?: string): boolean {
  const score = scoreObjective(objective);

  // For UI_TEXT_CHANGE stories, require score >= 0.4
  if (intentType === "UI_TEXT_CHANGE") {
    return score >= 0.4;
  }

  // For other intents, use standard threshold
  return score >= 0.3;
}
