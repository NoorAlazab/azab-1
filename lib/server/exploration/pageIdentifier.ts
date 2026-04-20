/**
 * Page Identifier
 * Identifies which pages are needed for testing based on story content
 * Uses AI analysis + keyword matching for accuracy
 */

import { log } from '@/lib/shared/utils/logger';

// Common page keywords and their normalized names
const PAGE_KEYWORDS: Record<string, string[]> = {
  'login': ['login', 'sign in', 'signin', 'log in', 'authentication', 'auth'],
  'signup': ['signup', 'sign up', 'register', 'registration', 'create account'],
  'dashboard': ['dashboard', 'home', 'overview', 'main page', 'landing'],
  'profile': ['profile', 'account', 'user profile', 'my account', 'account settings'],
  'settings': ['settings', 'preferences', 'configuration', 'options'],
  'users': ['users', 'user list', 'user management', 'manage users'],
  'projects': ['projects', 'project list', 'manage projects'],
  'tasks': ['tasks', 'task list', 'to-do', 'todos', 'assignments'],
  'reports': ['reports', 'analytics', 'reporting', 'insights'],
  'admin': ['admin', 'administration', 'admin panel', 'admin console'],
  'notifications': ['notifications', 'alerts', 'messages'],
  'search': ['search', 'find', 'lookup'],
  'checkout': ['checkout', 'cart', 'shopping cart', 'purchase'],
  'payment': ['payment', 'billing', 'pay', 'invoice'],
};

/**
 * Extract page names from story text using keyword matching
 */
function extractPagesFromKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const foundPages = new Set<string>();

  for (const [pageName, keywords] of Object.entries(PAGE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        foundPages.add(pageName);
        break; // Found this page, move to next
      }
    }
  }

  return Array.from(foundPages);
}

/**
 * Extract page names from story steps/scenarios
 */
function extractPagesFromSteps(steps: string[]): string[] {
  const pages = new Set<string>();

  for (const step of steps) {
    const stepPages = extractPagesFromKeywords(step);
    stepPages.forEach(page => pages.add(page));
  }

  return Array.from(pages);
}

/**
 * Extract raw keywords from story content (for journey-based discovery)
 * Returns actual keywords found in the story, not normalized page names
 */
export function extractPageKeywordsFromStory(
  storySummary: string,
  storyDescription: string,
  acceptanceCriteria: string,
  testScenarios: string[] = []
): string[] {
  log.debug('Extracting page keywords from story', {
    module: 'PageIdentifier',
    storySummary: storySummary.substring(0, 50),
  });

  const keywords = new Set<string>();
  const combinedText = `${storySummary} ${storyDescription} ${acceptanceCriteria} ${testScenarios.join(' ')}`;
  const lowerText = combinedText.toLowerCase();

  // Extract keywords that appear in the story
  for (const [pageName, pageKeywords] of Object.entries(PAGE_KEYWORDS)) {
    for (const keyword of pageKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        // Add the actual keyword found in the story, not the page name
        keywords.add(keyword);
        // Also add the normalized page name as a keyword
        keywords.add(pageName);
      }
    }
  }

  // Extract specific nouns that might be page names
  // Look for patterns like "on the X page", "X screen", "X view"
  const pagePatterns = [
    /(?:on|to|from|the)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:page|screen|view|panel|tab)/gi,
    /(?:navigate|go|visit|access|open)\s+(?:to|the)?\s+([a-z]+(?:\s+[a-z]+)?)/gi,
  ];

  for (const pattern of pagePatterns) {
    const matches = combinedText.matchAll(pattern);
    for (const match of matches) {
      const extracted = match[1]?.trim().toLowerCase();
      if (extracted && extracted.length > 2 && extracted.length < 30) {
        keywords.add(extracted);
      }
    }
  }

  // Extract capitalized terms that might be feature names (e.g., "Users", "Settings")
  const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  const capitalizedMatches = combinedText.matchAll(capitalizedPattern);
  for (const match of capitalizedMatches) {
    const term = match[1].toLowerCase();
    // Only include if it's not a common word and is likely a feature name
    if (term.length > 3 && !['the', 'this', 'that', 'user', 'when', 'then'].includes(term)) {
      keywords.add(term);
    }
  }

  const result = Array.from(keywords).filter(kw => kw.length > 2);

  log.debug('Extracted page keywords', {
    module: 'PageIdentifier',
    keywords: result,
    count: result.length,
  });

  return result;
}

/**
 * Identify required pages from story content
 * Uses keyword matching + heuristics for reliable extraction
 */
export function identifyPagesFromStory(
  storySummary: string,
  storyDescription: string,
  acceptanceCriteria: string,
  testScenarios: string[] = []
): string[] {
  log.debug('Identifying pages from story', {
    module: 'PageIdentifier',
    storySummary: storySummary.substring(0, 50),
  });

  const allPages = new Set<string>();

  // Extract from summary
  const summaryPages = extractPagesFromKeywords(storySummary);
  summaryPages.forEach(page => allPages.add(page));

  // Extract from description
  const descriptionPages = extractPagesFromKeywords(storyDescription);
  descriptionPages.forEach(page => allPages.add(page));

  // Extract from acceptance criteria
  const criteriaPages = extractPagesFromKeywords(acceptanceCriteria);
  criteriaPages.forEach(page => allPages.add(page));

  // Extract from test scenarios
  const scenarioPages = extractPagesFromSteps(testScenarios);
  scenarioPages.forEach(page => allPages.add(page));

  const pages = Array.from(allPages);

  // Always include login and dashboard as defaults if story mentions authentication
  const hasAuthContext = (
    storySummary.toLowerCase().includes('user') ||
    storyDescription.toLowerCase().includes('user') ||
    pages.length > 0
  );

  if (hasAuthContext) {
    if (!pages.includes('login')) {
      pages.unshift('login'); // Add login at the beginning
    }
    if (!pages.includes('dashboard') && pages.length > 1) {
      pages.splice(1, 0, 'dashboard'); // Add dashboard after login
    }
  }

  log.debug('Identified pages', {
    module: 'PageIdentifier',
    pages,
    count: pages.length,
  });

  return pages;
}

/**
 * Normalize a custom page name to a consistent format
 * Example: "User Profile Settings" → "user-profile-settings"
 */
export function normalizePageName(pageName: string): string {
  return pageName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Trim dashes from start/end
}

/**
 * Suggest page names that might be mentioned in the story
 * Useful for UI hints/autocomplete
 */
export function suggestPageNames(partialText: string): string[] {
  const lowerText = partialText.toLowerCase();
  const suggestions = new Set<string>();

  for (const [pageName, keywords] of Object.entries(PAGE_KEYWORDS)) {
    // Check if any keyword matches
    for (const keyword of keywords) {
      if (keyword.includes(lowerText) || lowerText.includes(keyword)) {
        suggestions.add(pageName);
        break;
      }
    }
  }

  return Array.from(suggestions);
}

/**
 * Add custom page keywords for domain-specific pages
 * Allows extending the keyword dictionary at runtime
 */
export function registerPageKeywords(pageName: string, keywords: string[]): void {
  PAGE_KEYWORDS[pageName] = keywords;
  log.debug('Registered custom page keywords', {
    module: 'PageIdentifier',
    pageName,
    keywords,
  });
}
