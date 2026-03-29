/**
 * Parse natural language test steps into executable actions
 * Supports common test patterns and converts them to Playwright actions
 */

import type { Page } from 'playwright';
import { log } from '@/lib/utils/logger';
import { extractElementKey } from './elementKeyMapper';

export type StepAction =
  | { type: 'navigate'; url: string; pageKeyword?: string }
  | { type: 'click'; target: string; elementKey?: string; selector?: string }
  | { type: 'fill'; target: string; value: string; elementKey?: string; selector?: string }
  | { type: 'verify_text'; text: string; shouldExist?: boolean }
  | { type: 'verify_element'; target: string; elementKey?: string; selector?: string; shouldExist?: boolean }
  | { type: 'verify_url'; url: string; exact?: boolean }
  | { type: 'wait'; duration?: number }
  | { type: 'screenshot'; name?: string }
  | { type: 'unknown'; rawStep: string };

/**
 * Parse a natural language step into an executable action
 */
export function parseStep(step: string): StepAction {
  const normalized = step.toLowerCase().trim();

  // Navigation patterns
  if (
    /^(navigate|go|visit|open|browse)\s+to\s+(.+)$/i.test(normalized) ||
    /^(load|access)\s+(.+)$/i.test(normalized)
  ) {
    const match =
      step.match(/(?:navigate|go|visit|open|browse|load|access)\s+to\s+(.+)$/i) ||
      step.match(/(?:load|access)\s+(.+)$/i);
    if (match) {
      let url = match[1].trim();
      let pageKeyword: string | undefined;

      // Extract URL from natural language (e.g., "the /login page" -> "/login")
      // Look for URLs or paths
      const urlMatch = url.match(/(https?:\/\/[^\s]+|\/[^\s]*)/);
      if (urlMatch) {
        url = urlMatch[1];
        // Try to extract keyword even from URL path
        const pathParts = url.split('/').filter(p => p.length > 0);
        if (pathParts.length > 0) {
          pageKeyword = pathParts[pathParts.length - 1]; // Last segment as keyword
        }
      } else {
        // Try to extract keyword and path from phrases like "the users page" or "users page"
        const keywordMatch = url.match(/(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:page|screen|view|tab)/i);
        if (keywordMatch) {
          const keyword = keywordMatch[1].trim();
          pageKeyword = keyword.toLowerCase().replace(/\s+/g, '-');
          // Also set url as path for fallback
          url = `/${keyword.toLowerCase().replace(/\s+/g, '-')}`;
        } else {
          // If just a word/phrase without "page", use it as keyword
          const simpleKeyword = url.match(/^(?:the\s+)?(\w+(?:\s+\w+)?)$/i);
          if (simpleKeyword) {
            pageKeyword = simpleKeyword[1].toLowerCase().replace(/\s+/g, '-');
            url = `/${pageKeyword}`;
          }
        }
      }

      return { type: 'navigate', url, pageKeyword };
    }
  }

  // Click patterns
  if (
    /^(click|press|tap|select)\s+(.+)$/i.test(normalized) ||
    /^(click|press|tap)\s+(?:on\s+)?(?:the\s+)?(.+)$/i.test(normalized)
  ) {
    const match = step.match(/(?:click|press|tap|select)\s+(?:on\s+)?(?:the\s+)?(.+)$/i);
    if (match) {
      const target = match[1].trim();
      const elementKey = extractElementKey(target);

      // Warn if no element key found (AI forgot backticks)
      if (!elementKey) {
        log.warn('Click step missing backtick notation - will use fuzzy matching', {
          module: 'StepParser',
          step,
          target,
          suggestion: 'AI should generate: Click `buttonName` instead of Click "Button Text"'
        });
      }

      return { type: 'click', target, elementKey: elementKey || undefined };
    }
  }

  // Fill/Enter patterns
  if (
    /^(enter|type|input|fill)\s+['""](.+?)['""]?\s+(?:into|in|to)\s+(?:the\s+)?(.+)$/i.test(normalized) ||
    /^(enter|type|input|fill)\s+(.+?)\s+(?:into|in|to)\s+(?:the\s+)?(.+)$/i.test(normalized)
  ) {
    const match = step.match(
      /(?:enter|type|input|fill)\s+['""]?(.+?)['""]?\s+(?:into|in|to)\s+(?:the\s+)?(.+)$/i
    );
    if (match) {
      const value = match[1].replace(/^['""]|['""]$/g, '').trim();
      const target = match[2].trim();
      const elementKey = extractElementKey(target);

      // Warn if no element key found (AI forgot backticks)
      if (!elementKey) {
        log.warn('Fill step missing backtick notation - will use fuzzy matching', {
          module: 'StepParser',
          step,
          target,
          value: value.substring(0, 20), // Log first 20 chars of value
          suggestion: 'AI should generate: Enter "value" in `inputName` instead of "in the field name"'
        });
      }

      return { type: 'fill', target, value, elementKey: elementKey || undefined };
    }
  }

  // Verify text patterns
  if (
    /^(verify|check|confirm|ensure|assert)\s+(?:that\s+)?(?:the\s+)?(?:text|message|label)\s+['""](.+?)['""]?\s+(?:is\s+)?(?:present|visible|displayed|exists|shown)/i.test(
      normalized
    ) ||
    /^(verify|check|confirm|ensure|assert)\s+['""](.+?)['""]?\s+(?:is\s+)?(?:present|visible|displayed|shown)/i.test(
      normalized
    ) ||
    /^(?:page|screen)\s+(?:shows|displays|contains)\s+['""](.+?)['""]?$/i.test(normalized)
  ) {
    const match =
      step.match(
        /(?:verify|check|confirm|ensure|assert)\s+(?:that\s+)?(?:the\s+)?(?:text|message|label)?\s*['""](.+?)['""]?\s+(?:is\s+)?(?:present|visible|displayed|exists|shown)/i
      ) || step.match(/(?:page|screen)\s+(?:shows|displays|contains)\s+['""](.+?)['""]?$/i);
    if (match) {
      const text = match[1].replace(/^['""]|['""]$/g, '').trim();
      const shouldExist = !/(?:not|doesn't|does not)\s+(?:exist|show|display|present)/.test(
        normalized
      );
      return { type: 'verify_text', text, shouldExist };
    }
  }

  // Verify element patterns
  if (
    /^(verify|check|confirm|ensure|assert)\s+(?:that\s+)?(?:the\s+)?(.+?)\s+(?:is\s+)?(?:present|visible|displayed|exists|shown|enabled|available)/i.test(
      normalized
    )
  ) {
    const match = step.match(
      /(?:verify|check|confirm|ensure|assert)\s+(?:that\s+)?(?:the\s+)?(.+?)\s+(?:is\s+)?(?:present|visible|displayed|exists|shown|enabled|available)/i
    );
    if (match) {
      const target = match[1].trim();
      const shouldExist = !/(?:not|doesn't|does not|isn't|is not)\s+(?:present|visible|displayed|shown)/.test(
        normalized
      );
      return { type: 'verify_element', target, shouldExist };
    }
  }

  // Verify URL patterns
  if (/^(verify|check|confirm|ensure|assert)\s+(?:the\s+)?(?:url|page)\s+(?:is|contains|matches)\s+(.+)$/i.test(normalized)) {
    const match = step.match(
      /(?:verify|check|confirm|ensure|assert)\s+(?:the\s+)?(?:url|page)\s+(?:is|contains|matches)\s+(.+)$/i
    );
    if (match) {
      const url = match[1].trim();
      const exact = /\s+is\s+/.test(normalized);
      return { type: 'verify_url', url, exact };
    }
  }

  // Wait patterns
  if (/^(?:wait|pause|sleep|delay)\s+(?:for\s+)?(\d+)?\s*(?:second|sec|s|ms|millisecond)?/i.test(normalized)) {
    const match = step.match(/(?:wait|pause|sleep|delay)\s+(?:for\s+)?(\d+)?\s*(?:second|sec|s|ms|millisecond)?/i);
    if (match) {
      const duration = match[1] ? parseInt(match[1]) : 1;
      // Check if it's seconds or milliseconds
      const isMs = /ms|millisecond/i.test(step);
      return { type: 'wait', duration: isMs ? duration : duration * 1000 };
    }
  }

  // Wait for page load
  if (/^wait\s+for\s+(?:page|loading|load)/i.test(normalized)) {
    return { type: 'wait', duration: 2000 }; // Default 2 seconds for page load
  }

  // Screenshot patterns
  if (/^(?:take|capture)\s+(?:a\s+)?screenshot/i.test(normalized)) {
    return { type: 'screenshot' };
  }

  // Unknown pattern - log for debugging
  log.warn('Unable to parse test step', { module: 'StepParser', step });
  return { type: 'unknown', rawStep: step };
}

/**
 * Guess a selector from a natural language target description
 * Returns potential CSS selectors to try in order of likelihood
 */
export function guessSelectors(target: string): string[] {
  const normalized = target.toLowerCase().trim();
  const selectors: string[] = [];

  // Remove common prefixes
  const cleaned = normalized
    .replace(/^(?:the\s+)?(?:a\s+)?/, '')
    .replace(/\s+(?:button|link|field|input|element|text|label)$/, '');

  // Try common patterns

  // 1. Exact text match for buttons and links
  selectors.push(`button:has-text("${cleaned}")`);
  selectors.push(`a:has-text("${cleaned}")`);
  selectors.push(`[role="button"]:has-text("${cleaned}")`);

  // 2. Partial text match (case-insensitive)
  selectors.push(`button:text("${cleaned}")`);
  selectors.push(`a:text("${cleaned}")`);

  // 3. Name/ID/placeholder matches
  selectors.push(`[name="${cleaned}"]`);
  selectors.push(`#${cleaned.replace(/\s+/g, '-')}`);
  selectors.push(`[placeholder*="${cleaned}"]`);
  selectors.push(`[aria-label*="${cleaned}"]`);

  // 4. Class-based selectors (for single-word targets)
  if (!cleaned.includes(' ')) {
    selectors.push(`.${cleaned}`);
  }

  // 5. Type-based selectors for common inputs
  if (/email/.test(normalized)) {
    selectors.push('input[type="email"]');
  }
  if (/password/.test(normalized)) {
    selectors.push('input[type="password"]');
  }
  if (/username|user/.test(normalized)) {
    selectors.push('input[name*="user"]');
    selectors.push('input[id*="user"]');
  }
  if (/submit/.test(normalized)) {
    selectors.push('button[type="submit"]');
    selectors.push('input[type="submit"]');
  }

  return selectors;
}

/**
 * Try multiple selectors and return the first one that works
 */
export async function findElement(page: Page, target: string): Promise<any | null> {
  const selectors = guessSelectors(target);

  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      // Check if element exists and is visible
      const count = await element.count();
      if (count > 0) {
        const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVisible) {
          log.debug('Found element with selector', { module: 'StepParser', selector, target });
          return element;
        }
      }
    } catch (error) {
      // Continue to next selector
      continue;
    }
  }

  log.warn('Could not find element', { module: 'StepParser', target, triedSelectors: selectors.length });
  return null;
}
