import type { Page } from "playwright";
import { log } from '@/lib/shared/utils/logger';
import type { PageJourney, NavigationItem, JourneyStep } from '@/types/journey';
import type { ElementSelector } from '@/types/selectors';
import { normalizePageKeyword } from '@/lib/shared/utils/pageKeywordNormalizer';

/**
 * Discover login/authentication pages from base URL
 * Tries common paths and performs shallow crawl for login links
 */
export async function discoverLoginPaths(
  page: Page,
  baseUrl: string
): Promise<string[]> {
  const discoveredPaths = new Set<string>();
  const baseOrigin = new URL(baseUrl).origin;

  // Common login paths to try
  const commonPaths = [
    "/login",
    "/signin",
    "/sign-in",
    "/auth/login",
    "/auth/signin",
    "/authentication",
    "/account/login",
    "/user/login",
  ];

  log.debug('Starting path discovery', { module: 'PageDiscovery', baseOrigin });

  // Try each common path
  for (const path of commonPaths) {
    const testUrl = `${baseOrigin}${path}`;
    try {
      const response = await page.goto(testUrl, {
        waitUntil: "domcontentloaded",
        timeout: 5000,
      });

      if (response && response.ok()) {
        log.debug('Found accessible path', { module: 'PageDiscovery', path });
        discoveredPaths.add(testUrl);
      }
    } catch (error) {
      // Path not accessible, continue
      log.debug('Path not accessible', { module: 'PageDiscovery', path });
    }
  }

  // Crawl depth=1 from base URL for login/signin links
  try {
    log.debug('Crawling base URL for login links', { module: 'PageDiscovery' });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 10000 });

    // Find all same-origin links with login/signin text
    const loginLinks = await page.evaluate((origin) => {
      const links = Array.from(document.querySelectorAll("a[href]"));
      const loginPatterns = /login|sign.?in|auth/i;

      return links
        .filter((link) => {
          const href = link.getAttribute("href");
          const text = link.textContent?.trim() || "";
          const ariaLabel = link.getAttribute("aria-label") || "";

          // Check if text or aria-label contains login/signin
          const hasLoginText = loginPatterns.test(text) || loginPatterns.test(ariaLabel);
          if (!hasLoginText) return false;

          // Check if same origin
          try {
            const url = new URL(href!, window.location.href);
            return url.origin === origin;
          } catch {
            return false;
          }
        })
        .map((link) => {
          const href = link.getAttribute("href")!;
          try {
            return new URL(href, window.location.href).href;
          } catch {
            return null;
          }
        })
        .filter((url): url is string => url !== null);
    }, baseOrigin);

    for (const link of loginLinks) {
      log.debug('Found login link', { module: 'PageDiscovery', link });
      discoveredPaths.add(link);
    }
  } catch (error) {
    log.error('Error crawling base URL', error instanceof Error ? error : new Error(String(error)), { module: 'PageDiscovery' });
  }

  const paths = Array.from(discoveredPaths);
  log.debug('Discovery complete', { module: 'PageDiscovery', pathCount: paths.length });
  return paths;
}

/**
 * Dismiss common banners and modals that might obscure content
 */
export async function dismissBanners(page: Page): Promise<void> {
  try {
    // Common close button selectors
    const closeSelectors = [
      'button[aria-label*="close" i]',
      'button[aria-label*="dismiss" i]',
      'button[class*="close" i]',
      'button[class*="dismiss" i]',
      '[role="dialog"] button',
      ".modal-close",
      ".banner-close",
      ".cookie-close",
    ];

    for (const selector of closeSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click({ timeout: 1000 });
          log.debug('Dismissed banner/modal', { module: 'PageDiscovery' });
          await page.waitForTimeout(500); // Let animation complete
        }
      } catch {
        // Selector not found or not clickable, continue
      }
    }
  } catch (error) {
    log.error('Error dismissing banners', error instanceof Error ? error : new Error(String(error)), { module: 'PageDiscovery' });
  }
}

/**
 * Check if URL is same-origin (domain-only scope)
 */
export function isSameOrigin(url: string, baseUrl: string): boolean {
  try {
    const urlOrigin = new URL(url).origin;
    const baseOrigin = new URL(baseUrl).origin;
    return urlOrigin === baseOrigin;
  } catch {
    return false;
  }
}

/**
 * Check if URL points to third-party SSO
 */
export function isThirdPartySSO(url: string): boolean {
  const ssoPatterns = [
    /google\.com/i,
    /microsoft\.com/i,
    /login\.microsoftonline\.com/i,
    /github\.com/i,
    /facebook\.com/i,
    /twitter\.com/i,
    /linkedin\.com/i,
    /okta\.com/i,
    /auth0\.com/i,
    /onelogin\.com/i,
  ];

  return ssoPatterns.some((pattern) => pattern.test(url));
}

/**
 * Scan navigation menu and extract all navigation items
 * Finds navigation elements in headers, sidebars, and menus
 */
export async function scanNavigationMenu(page: Page): Promise<NavigationItem[]> {
  log.debug('Scanning navigation menu', { module: 'PageDiscovery' });

  const navigationItems = await page.evaluate(() => {
    const items: NavigationItem[] = [];

    // Common navigation selectors
    const navSelectors = [
      'nav a',                    // Links in nav elements
      '[role="navigation"] a',    // ARIA navigation links
      'header a',                 // Links in header
      'aside a',                  // Links in sidebar
      '[class*="menu"] a',        // Links in elements with "menu" class
      '[class*="nav"] a',         // Links in elements with "nav" class
      '[class*="sidebar"] a',     // Links in sidebar elements
    ];

    const processedHrefs = new Set<string>();

    for (const selector of navSelectors) {
      const links = document.querySelectorAll(selector);

      for (const link of links) {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim() || '';

        // Skip if no href, no text, or already processed
        if (!href || !text || processedHrefs.has(href)) continue;

        // Skip external links
        try {
          const url = new URL(href, window.location.href);
          if (url.origin !== window.location.origin) continue;
        } catch {
          continue;
        }

        // Generate unique selector for this element
        let elementSelector = '';
        try {
          const element = link as HTMLElement;
          // Try to build a robust selector
          if (element.id) {
            elementSelector = `#${element.id}`;
          } else if (element.className) {
            const classes = Array.from(element.classList).join('.');
            elementSelector = `${element.tagName.toLowerCase()}.${classes}`;
          } else {
            elementSelector = element.tagName.toLowerCase();
          }

          // Add href attribute to make selector more specific
          elementSelector += `[href="${href}"]`;
        } catch {
          elementSelector = `a[href="${href}"]`;
        }

        // Extract keywords from the text
        const keywords = text
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 2); // Filter out short words

        items.push({
          text,
          selector: elementSelector,
          keywords,
          href,
        });

        processedHrefs.add(href);
      }
    }

    return items;
  });

  log.debug('Navigation scan complete', {
    module: 'PageDiscovery',
    itemCount: navigationItems.length,
    items: navigationItems.slice(0, 5).map(i => ({ text: i.text, href: i.href }))
  });

  return navigationItems;
}

/**
 * Match a keyword to navigation items using semantic matching
 * Handles plurals, variations, and partial matches
 */
export function matchKeywordToNavigation(
  keyword: string,
  navigationItems: NavigationItem[]
): NavigationItem | null {
  const normalizedKeyword = keyword.toLowerCase().trim();

  log.debug('Matching keyword to navigation', {
    module: 'PageDiscovery',
    keyword: normalizedKeyword
  });

  // Common keyword variations and synonyms
  const synonyms: Record<string, string[]> = {
    'users': ['user', 'users', 'people', 'members', 'team', 'accounts'],
    'settings': ['setting', 'settings', 'preferences', 'configuration', 'config'],
    'dashboard': ['dashboard', 'home', 'overview', 'main'],
    'profile': ['profile', 'account', 'me', 'my account'],
    'admin': ['admin', 'administration', 'manage', 'management'],
    'reports': ['report', 'reports', 'analytics', 'insights'],
    'products': ['product', 'products', 'catalog', 'items'],
    'orders': ['order', 'orders', 'purchases', 'transactions'],
  };

  // Get all variations of the keyword
  const keywordVariations = [normalizedKeyword];
  for (const [key, variations] of Object.entries(synonyms)) {
    if (variations.includes(normalizedKeyword)) {
      keywordVariations.push(...variations);
      break;
    }
  }

  // Scoring function for match quality
  const scoreMatch = (item: NavigationItem): number => {
    let score = 0;
    const itemText = item.text.toLowerCase();
    const itemTextNormalized = normalizePageKeyword(item.text); // Normalize for comparison

    // Exact match in normalized text
    if (keywordVariations.some(kw => itemTextNormalized === kw || itemText === kw)) {
      score += 100;
    }

    // Exact word match in text (or normalized match for multi-word items)
    const words = itemText.split(/\s+/);
    if (keywordVariations.some(kw => words.includes(kw) || itemTextNormalized === kw)) {
      score += 50;
    }

    // Partial match in text
    if (keywordVariations.some(kw => itemText.includes(kw))) {
      score += 25;
    }

    // Match in keywords array
    const matchingKeywords = item.keywords.filter(k =>
      keywordVariations.some(kw => k.includes(kw) || kw.includes(k))
    );
    score += matchingKeywords.length * 10;

    return score;
  };

  // Score all items and find best match
  const scoredItems = navigationItems
    .map(item => ({ item, score: scoreMatch(item) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredItems.length > 0) {
    const bestMatch = scoredItems[0];
    log.debug('Found navigation match', {
      module: 'PageDiscovery',
      keyword: normalizedKeyword,
      matchedText: bestMatch.item.text,
      score: bestMatch.score,
    });
    return bestMatch.item;
  }

  log.debug('No navigation match found', {
    module: 'PageDiscovery',
    keyword: normalizedKeyword
  });
  return null;
}

/**
 * Build a journey to a page by clicking through navigation
 * Records the steps taken and the final URL reached
 */
export async function buildJourneyToPage(
  page: Page,
  startingUrl: string,
  navigationItem: NavigationItem,
  pageKeyword: string,
  environmentSlug: string
): Promise<PageJourney | null> {
  log.debug('Building journey to page', {
    module: 'PageDiscovery',
    pageKeyword,
    navigationText: navigationItem.text,
  });

  try {
    // Ensure we're at the starting URL
    if (page.url() !== startingUrl) {
      await page.goto(startingUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    }

    const steps: JourneyStep[] = [];

    // Step 1: Click the navigation item
    const clickStep: JourneyStep = {
      action: 'click',
      target: navigationItem.text,
      targetSelector: navigationItem.selector,
      description: `Click '${navigationItem.text}' in navigation menu`,
    };

    // Wait for navigation item to be visible and clickable
    await page.waitForSelector(navigationItem.selector, {
      state: 'visible',
      timeout: 5000
    });

    // Capture URL before navigation
    const urlBeforeClick = page.url();

    // Click the element
    await page.click(navigationItem.selector);

    // Wait for URL change with timeout (handles real navigation)
    try {
      await page.waitForURL(
        (url) => url.toString() !== urlBeforeClick,
        { waitUntil: 'domcontentloaded', timeout: 5000 }
      );
      log.debug('URL changed after click', {
        module: 'PageDiscovery',
        from: urlBeforeClick,
        to: page.url()
      });
    } catch {
      // URL didn't change - might be modal/SPA, wait for network to stabilize
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {
        // If networkidle times out, that's okay - page might still be loading
        log.debug('Network idle timeout, continuing anyway', {
          module: 'PageDiscovery',
        });
      });
      log.debug('URL unchanged after click, waited for network idle', {
        module: 'PageDiscovery',
        url: page.url()
      });
    }

    // Additional stability wait to ensure page is fully rendered
    await page.waitForTimeout(500);

    const finalUrl = page.url();
    clickStep.expectedUrl = finalUrl;
    steps.push(clickStep);

    log.debug('Navigation successful', {
      module: 'PageDiscovery',
      pageKeyword,
      finalUrl,
    });

    // Create the journey
    const journey: PageJourney = {
      pageKeyword,
      actualUrl: finalUrl,
      startingUrl,
      steps,
      selectors: {}, // Will be populated by selector recorder later
      discoveredAt: new Date().toISOString(),
      environmentSlug,
      alternativeKeywords: navigationItem.keywords,
      navigationItemText: navigationItem.text,
    };

    return journey;

  } catch (error) {
    log.error('Failed to build journey', error instanceof Error ? error : new Error(String(error)), {
      module: 'PageDiscovery',
      pageKeyword,
      navigationText: navigationItem.text,
    });
    return null;
  }
}

/**
 * Discover pages by following navigation after login
 * Returns PageJourney objects for each discovered page
 */
export async function discoverPages(
  page: Page,
  baseUrl: string,
  targetKeywords: string[],
  environmentSlug: string,
  maxPages: number = 10
): Promise<PageJourney[]> {
  log.debug('Starting page discovery', {
    module: 'PageDiscovery',
    targetKeywords,
    maxPages,
    currentUrl: page.url(),
  });

  const discoveredJourneys: PageJourney[] = [];
  const currentUrl = page.url();

  try {
    // Dismiss any banners/modals that might obscure navigation
    await dismissBanners(page);

    // Scan navigation menu
    const navigationItems = await scanNavigationMenu(page);

    log.debug('Navigation scan complete', {
      module: 'PageDiscovery',
      itemsFound: navigationItems.length,
      sampleItems: navigationItems.slice(0, 10).map(i => i.text),
    });

    if (navigationItems.length === 0) {
      log.warn('No navigation items found - page might not have loaded properly', {
        module: 'PageDiscovery',
        currentUrl: page.url(),
        pageTitle: await page.title().catch(() => 'unknown'),
      });
      return [];
    }

    // If no keywords provided, discover ALL navigation items
    let keywordsToDiscover: string[];
    if (!targetKeywords || targetKeywords.length === 0) {
      log.debug('No keywords provided - will discover ALL navigation items', {
        module: 'PageDiscovery',
        navigationItemCount: navigationItems.length,
      });
      // Extract keywords from navigation text AND NORMALIZE THEM
      keywordsToDiscover = navigationItems
        .map(item => normalizePageKeyword(item.text))
        .filter(text => text.length > 0 && text.length < 30) // Reasonable keyword length
        .slice(0, maxPages); // Limit to maxPages
    } else {
      // Normalize provided keywords too
      keywordsToDiscover = targetKeywords.map(k => normalizePageKeyword(k));
    }

    // Match each keyword to navigation items
    for (const keyword of keywordsToDiscover) {
      if (discoveredJourneys.length >= maxPages) {
        log.debug('Reached max pages limit', { module: 'PageDiscovery' });
        break;
      }

      const match = matchKeywordToNavigation(keyword, navigationItems);
      if (!match) {
        log.debug('No match for keyword', { module: 'PageDiscovery', keyword });
        continue;
      }

      // Build journey to this page (keyword is already normalized)
      const journey = await buildJourneyToPage(
        page,
        currentUrl,
        match,
        keyword,
        environmentSlug
      );

      if (journey) {
        discoveredJourneys.push(journey);

        // Return to starting point for next discovery
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded' });
        await dismissBanners(page);
      }
    }

    log.debug('Page discovery complete', {
      module: 'PageDiscovery',
      discoveredCount: discoveredJourneys.length,
      pages: discoveredJourneys.map(j => ({ keyword: j.pageKeyword, url: j.actualUrl })),
    });

    return discoveredJourneys;

  } catch (error) {
    log.error('Page discovery failed', error instanceof Error ? error : new Error(String(error)), {
      module: 'PageDiscovery',
    });
    return discoveredJourneys; // Return whatever we discovered so far
  }
}
