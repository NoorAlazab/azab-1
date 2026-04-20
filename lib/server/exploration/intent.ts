/**
 * Story intent classifier
 * Determines what kind of testing is needed based on story content
 */

import { log } from '@/lib/shared/utils/logger';

export type StoryIntent =
  | "UI_TEXT_CHANGE"
  | "UI_ELEMENT_PRESENCE"
  | "NAVIGATION"
  | "AUTH_FLOW"
  | "FORM_VALIDATION"
  | "A11Y"
  | "OTHER";

export interface IntentClassification {
  intents: StoryIntent[];
  terms: {
    from?: string;
    to?: string;
    elementHints: string[];
  };
}

// Synonym tables for common text variations
const SIGNIN_SYNONYMS = ["sign in", "signin", "log in", "log-in", "sign-in"];
const LOGIN_SYNONYMS = ["login", "log in", "log-in"];
const SIGNUP_SYNONYMS = ["sign up", "signup", "register", "sign-up"];
const SUBMIT_SYNONYMS = ["submit", "send", "save"];

/**
 * Classify the intent of a story based on its content
 */
export function classifyIntent(
  summary: string,
  description?: string,
  acceptanceCriteria?: string
): IntentClassification {
  const allText = `${summary} ${description || ""} ${acceptanceCriteria || ""}`.toLowerCase();
  const summaryLower = summary.toLowerCase();

  log.debug('Classifying story', { module: 'Intent', summary: summaryLower });

  const intents: StoryIntent[] = [];
  const terms: IntentClassification["terms"] = {
    elementHints: [],
  };

  // UI_TEXT_CHANGE detection (highest priority)
  const textChangePatterns = [
    // "rename button to X" or "change button to X"
    /(rename|change|update)\s+(?:the\s+)?(button|link|label|text|cta)[^]*?\bto\b\s+["']?([a-z0-9][a-z0-9 _-]*)["']?/i,
    // "button text should be X"
    /(button|link|cta|label)\s+(?:text|label)?\s*(?:should|must|needs to)\s+(?:be|say|read)\s+["']?([a-z0-9][a-z0-9 _-]*)["']?/i,
    // "X button should be Y" - allows multi-word phrases like "sign in"
    /["']?([a-z0-9][a-z0-9 _-]*)["']?\s+(button|link|cta)\s+(?:should|must)\s+(?:be|say|read|become)\s+["']?([a-z0-9][a-z0-9 _-]*)["']?/i,
  ];

  for (const pattern of textChangePatterns) {
    const match = summaryLower.match(pattern);
    if (match) {
      log.debug('Matched UI_TEXT_CHANGE pattern', { module: 'Intent', patternSource: pattern.source, matchGroups: match });

      intents.push("UI_TEXT_CHANGE");

      // Extract element type
      const elementType = match[2] || match[1];
      if (["button", "link", "cta", "label"].includes(elementType)) {
        terms.elementHints.push(elementType === "cta" ? "button" : elementType);
      }

      // Extract from/to terms
      if (pattern.source.includes("rename|change|update")) {
        // Pattern 1: "rename X to Y"
        terms.to = match[3]?.trim();
        // Try to find 'from' in preceding text
        const fromMatch = summaryLower.match(/(?:rename|change|update)\s+(?:the\s+)?(?:button|link|label|text|cta)\s+["']?([a-z0-9][a-z0-9 _-]*)["']?\s+to/i);
        if (fromMatch) {
          terms.from = fromMatch[1].trim();
        }
      } else if (pattern.source.includes("should|must|needs") && !pattern.source.includes("X button")) {
        // Pattern 2: "button text should be Y"
        terms.to = match[2]?.trim();
      } else {
        // Pattern 3: "X button should be Y"
        terms.from = match[1]?.trim();
        terms.to = match[3]?.trim();
      }

      log.debug('Extracted terms', { module: 'Intent', from: terms.from, to: terms.to, elementHints: terms.elementHints });

      break; // Found UI_TEXT_CHANGE, stop checking other patterns
    }
  }

  // If we found UI_TEXT_CHANGE, expand synonyms
  if (intents.includes("UI_TEXT_CHANGE") && terms.to) {
    // Normalize terms with synonyms
    const toNormalized = terms.to.toLowerCase().replace(/['"]/g, '').trim();
    const fromNormalized = terms.from?.toLowerCase().replace(/['"]/g, '').trim();

    // Check if 'from' matches common signin synonyms
    if (fromNormalized && SIGNIN_SYNONYMS.some(syn => syn === fromNormalized || fromNormalized.includes(syn))) {
      terms.from = "sign in"; // Normalize
    }

    // Check if 'to' matches common login synonyms
    if (LOGIN_SYNONYMS.some(syn => syn === toNormalized || toNormalized.includes(syn))) {
      terms.to = "login"; // Normalize
    }
  }

  // AUTH_FLOW detection (only if explicit)
  const authPatterns = [
    /authenticat/i,
    /credentials/i,
    /username.*password/i,
    /password.*username/i,
    /sso\b/i,
    /session/i,
    /logout/i,
  ];

  const hasAuthFlow = authPatterns.some(p => p.test(allText)) ||
    (acceptanceCriteria && /success.*fail|pass.*fail/i.test(acceptanceCriteria));

  if (hasAuthFlow && !intents.includes("UI_TEXT_CHANGE")) {
    intents.push("AUTH_FLOW");
    terms.elementHints.push("button", "textbox");
  }

  // FORM_VALIDATION detection (only if explicit)
  const validationPatterns = [
    /\brequired\s+field/i,
    /invalid\s+/i,
    /error\s+message/i,
    /validat/i,
    /\bfield\s+.*\bmust\b/i,
    /cannot\s+be\s+empty/i,
  ];

  const hasValidation = validationPatterns.some(p => p.test(allText));
  if (hasValidation && !intents.includes("UI_TEXT_CHANGE")) {
    intents.push("FORM_VALIDATION");
    terms.elementHints.push("textbox", "button");
  }

  // NAVIGATION detection
  const navPatterns = [
    /navigat.*to/i,
    /redirect.*to/i,
    /route.*to/i,
    /go.*to.*page/i,
  ];

  if (navPatterns.some(p => p.test(allText)) && !intents.includes("UI_TEXT_CHANGE")) {
    intents.push("NAVIGATION");
  }

  // UI_ELEMENT_PRESENCE detection
  const presencePatterns = [
    /\badd\s+(?:a|an|the)?\s*(button|link|icon|field|input)/i,
    /\bshow\s+(?:a|an|the)?\s*(button|link|icon|field)/i,
    /\bdisplay\s+(?:a|an|the)?\s*(button|link|icon|field)/i,
    /\b(?:button|link|icon|field)\s+(?:should|must)\s+(?:be\s+)?(?:visible|present|shown)/i,
  ];

  if (presencePatterns.some(p => p.test(summaryLower)) && !intents.includes("UI_TEXT_CHANGE")) {
    intents.push("UI_ELEMENT_PRESENCE");
    const match = summaryLower.match(/(button|link|icon|field|input)/i);
    if (match) {
      terms.elementHints.push(match[1]);
    }
  }

  // A11Y detection
  const a11yPatterns = [
    /accessibility/i,
    /\ba11y\b/i,
    /\bwcag\b/i,
    /screen\s+reader/i,
    /keyboard\s+navigat/i,
    /aria/i,
  ];

  if (a11yPatterns.some(p => p.test(allText))) {
    intents.push("A11Y");
  }

  // Default to OTHER if no specific intent found
  if (intents.length === 0) {
    intents.push("OTHER");
  }

  // Deduplicate element hints
  terms.elementHints = Array.from(new Set(terms.elementHints));

  log.debug('Final classification', { module: 'Intent', intents, terms });

  return { intents, terms };
}

/**
 * Get synonym variants for a term
 */
export function getSynonyms(term: string): string[] {
  const normalized = term.toLowerCase().trim();

  if (SIGNIN_SYNONYMS.includes(normalized)) {
    return SIGNIN_SYNONYMS;
  }
  if (LOGIN_SYNONYMS.includes(normalized)) {
    return LOGIN_SYNONYMS;
  }
  if (SIGNUP_SYNONYMS.includes(normalized)) {
    return SIGNUP_SYNONYMS;
  }
  if (SUBMIT_SYNONYMS.includes(normalized)) {
    return SUBMIT_SYNONYMS;
  }

  return [normalized];
}

/**
 * Calculate token overlap between objective and story
 */
export function calculateTokenOverlap(objectiveText: string, storyText: string): number {
  const objTokens = new Set(
    objectiveText.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  );

  const storyTokens = new Set(
    storyText.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  );

  const intersection = new Set([...objTokens].filter(t => storyTokens.has(t)));
  const union = new Set([...objTokens, ...storyTokens]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Normalize label text for comparison
 * - Lowercase
 * - Trim whitespace
 * - Replace hyphens with spaces
 * - Collapse multiple spaces
 */
export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Check if a name matches any of the terms (case-insensitive, normalized)
 */
export function isLabelMatch(name: string, terms: string[]): boolean {
  const normalized = normalizeLabel(name);
  return terms.some(term => normalizeLabel(term) === normalized);
}

/**
 * Extract label change information from story
 * Returns expanded synonym sets for robust matching
 */
export function extractLabelChange(
  summary: string,
  description?: string,
  acceptanceCriteria?: string
): { fromTerms: string[]; toTerms: string[] } {
  const classification = classifyIntent(summary, description, acceptanceCriteria);

  if (!classification.terms.to) {
    return { fromTerms: [], toTerms: [] };
  }

  // Get base terms
  const toBase = classification.terms.to;
  const fromBase = classification.terms.from;

  // Expand to synonym sets
  const toTerms = getSynonyms(toBase);
  const fromTerms = fromBase ? getSynonyms(fromBase) : [];

  log.debug('Extracted label change', {
    module: 'Intent',
    from: fromBase,
    fromTerms,
    to: toBase,
    toTerms,
  });

  return { fromTerms, toTerms };
}
