/**
 * Element Key Mapper
 * Maps natural language descriptions to element keys in selector repository
 * Example: "Click the login button" → "loginButton"
 */

import { getElementKeys, loadSelectorMapping } from './selectorRepository';
import { log } from '@/lib/shared/utils/logger';

/**
 * Extract element key from backtick notation
 * Example: "Click `loginButton`" → "loginButton"
 */
export function extractElementKey(text: string): string | null {
  const backtickMatch = text.match(/`([a-zA-Z0-9_]+)`/);
  if (backtickMatch) {
    return backtickMatch[1];
  }
  return null;
}

/**
 * Map natural language target to element key using fuzzy matching
 * NEW: Supports database-first loading via environmentConfigId
 */
export async function mapToElementKey(
  target: string,
  pageName: string,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<string | null> {
  // First check if it's already in backtick notation
  const explicitKey = extractElementKey(target);
  if (explicitKey) {
    return explicitKey;
  }

  // Get available element keys for this page (with environment context)
  const elementKeys = await getElementKeys(pageName, environmentSlug, environmentConfigId);
  if (elementKeys.length === 0) {
    return null;
  }

  // Try to find best match
  const bestMatch = findBestMatch(target, elementKeys);

  // Lowered threshold from 0.6 to 0.4 for more lenient matching (fallback when AI forgets backticks)
  if (bestMatch.score > 0.4) {
    log.debug('Mapped natural language to element key', {
      module: 'ElementKeyMapper',
      target,
      elementKey: bestMatch.key,
      score: bestMatch.score,
      environmentSlug,
      environmentConfigId,
      threshold: 0.4,
    });
    return bestMatch.key;
  }

  // Log when mapping fails to help debugging
  log.warn('Failed to map natural language to element key', {
    module: 'ElementKeyMapper',
    target,
    bestMatchKey: bestMatch.key,
    bestScore: bestMatch.score,
    threshold: 0.4,
    availableKeys: elementKeys.slice(0, 5).join(', '), // Show first 5 keys
  });

  return null;
}

/**
 * Find best matching element key for a target description
 */
function findBestMatch(
  target: string,
  elementKeys: string[]
): { key: string; score: number } {
  let bestMatch = { key: '', score: 0 };

  const normalizedTarget = normalizeText(target);

  for (const elementKey of elementKeys) {
    const normalizedKey = normalizeText(elementKey);
    const score = calculateSimilarity(normalizedTarget, normalizedKey);

    if (score > bestMatch.score) {
      bestMatch = { key: elementKey, score };
    }

    // Check if target contains the key
    if (normalizedTarget.includes(normalizedKey)) {
      const containsScore = 0.8;
      if (containsScore > bestMatch.score) {
        bestMatch = { key: elementKey, score: containsScore };
      }
    }

    // Check common variations
    const variations = generateVariations(elementKey);
    for (const variation of variations) {
      if (normalizedTarget.includes(variation)) {
        const varScore = 0.75;
        if (varScore > bestMatch.score) {
          bestMatch = { key: elementKey, score: varScore };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Normalize text for comparison
 * Enhanced to remove common words that add noise to matching
 */
function normalizeText(text: string): string {
  // First convert to lowercase
  let normalized = text.toLowerCase();

  // Remove common filler words that don't help matching
  const commonWords = ['the', 'a', 'an', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being'];
  for (const word of commonWords) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  }

  // Remove non-alphanumeric characters
  normalized = normalized.replace(/[^a-z0-9]/g, '');

  return normalized.trim();
}

/**
 * Generate common variations of an element key
 * Example: "loginButton" → ["login", "button", "loginbutton", "login button"]
 */
function generateVariations(elementKey: string): string[] {
  const variations: string[] = [];

  // Original normalized
  variations.push(normalizeText(elementKey));

  // Split camelCase: loginButton → ["login", "button"]
  const words = elementKey.split(/(?=[A-Z])/);
  variations.push(...words.map(w => normalizeText(w)));

  // Common type variations
  const typeMap: Record<string, string[]> = {
    button: ['btn', 'submit'],
    field: ['input', 'textbox'],
    link: ['anchor', 'href'],
    checkbox: ['check', 'tick'],
  };

  for (const word of words) {
    const normalized = normalizeText(word);
    if (typeMap[normalized]) {
      variations.push(...typeMap[normalized]);
    }
  }

  return variations;
}

/**
 * Calculate similarity between two strings using simple algorithm
 * Returns score between 0 and 1
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0;

  // Simple substring matching
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }

  // Character overlap
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  let overlap = 0;

  for (const char of set1) {
    if (set2.has(char)) {
      overlap++;
    }
  }

  return overlap / Math.max(set1.size, set2.size);
}

/**
 * Get suggestions for unmapped targets
 * NEW: Supports database-first loading via environmentConfigId
 */
export async function suggestElementKeys(
  target: string,
  pageName: string,
  topN: number = 3,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<Array<{ key: string; score: number }>> {
  const elementKeys = await getElementKeys(pageName, environmentSlug, environmentConfigId);
  if (elementKeys.length === 0) {
    return [];
  }

  const normalizedTarget = normalizeText(target);
  const scores = elementKeys.map(key => ({
    key,
    score: calculateSimilarity(normalizedTarget, normalizeText(key)),
  }));

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, topN);
}

/**
 * Infer page name from URL or context
 */
export function inferPageName(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Remove leading/trailing slashes
    const cleanPath = path.replace(/^\/+|\/+$/g, '');

    // If empty, it's the root/home page
    if (!cleanPath) {
      return 'dashboard'; // Default to dashboard
    }

    // Extract first segment for page name
    const firstSegment = cleanPath.split('/')[0];
    return firstSegment || 'dashboard';
  } catch (error) {
    // If URL parsing fails, return default
    return 'dashboard';
  }
}
