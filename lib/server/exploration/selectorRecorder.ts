/**
 * Selector Recorder
 * Records element selectors from web pages using Playwright
 * Stores selectors in environment-specific directories
 */

import type { Page } from 'playwright';
import { log } from '@/lib/shared/utils/logger';
import type {
  SelectorRecordingResult,
  EnvironmentCredentials,
  PageRecordingMetadata
} from '@/types/environment';
import type { ElementSelector, SelectorMapping } from '@/types/selectors';
import type { PageJourney } from '@/types/journey';
import { normalizeEnvironmentUrl } from './environmentManager';
import { discoverPages } from './pageDiscovery';
import {
  addOrUpdateJourney,
  updateJourneySelectors,
  setLoginJourney
} from './journeyRepository';
import fs from 'fs/promises';
import path from 'path';

/**
 * Infer page name from URL (same logic as elementKeyMapper)
 * This ensures we save selectors with the same page name that test executor will use
 */
function inferPageNameFromUrl(url: string): string {
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

/**
 * Record selectors for a list of pages
 */
export async function recordSelectorsForPages(
  page: Page,
  environmentUrl: string,
  pages: string[],
  credentials?: EnvironmentCredentials,
  storyKey?: string
): Promise<SelectorRecordingResult[]> {
  const results: SelectorRecordingResult[] = [];
  const environmentSlug = normalizeEnvironmentUrl(environmentUrl);

  log.debug('Starting selector recording', {
    module: 'SelectorRecorder',
    environmentUrl,
    environmentSlug,
    pages,
    hasCredentials: !!credentials,
  });

  // Navigate to environment
  try {
    await page.goto(environmentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000); // Wait for page to stabilize
  } catch (error) {
    log.error('Failed to navigate to environment', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorRecorder',
      environmentUrl,
    });
    throw new Error(`Failed to navigate to ${environmentUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // If on login page and credentials provided, login first
  if (credentials && credentials.username && credentials.password) {
    await performLogin(page, credentials);
  }

  // Record each page
  for (const pageName of pages) {
    try {
      const result = await recordPageSelectors(
        page,
        pageName,
        environmentUrl,
        environmentSlug,
        storyKey
      );
      results.push(result);
    } catch (error) {
      log.error('Failed to record page', error instanceof Error ? error : new Error(String(error)), {
        module: 'SelectorRecorder',
        pageName,
      });
      results.push({
        page: pageName,
        elementsRecorded: 0,
        filePath: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Record selectors using journey-based page discovery
 * Discovers pages by following navigation instead of hardcoded URLs
 */
export async function recordSelectorsWithJourneys(
  page: Page,
  environmentUrl: string,
  pageKeywords: string[],
  credentials?: EnvironmentCredentials,
  storyKey?: string
): Promise<{
  results: SelectorRecordingResult[];
  journeys: PageJourney[];
}> {
  const results: SelectorRecordingResult[] = [];
  const journeys: PageJourney[] = [];
  const environmentSlug = normalizeEnvironmentUrl(environmentUrl);

  log.debug('Starting journey-based selector recording', {
    module: 'SelectorRecorder',
    environmentUrl,
    environmentSlug,
    pageKeywords,
    hasCredentials: !!credentials,
  });

  // Navigate to environment
  try {
    await page.goto(environmentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000); // Wait for page to stabilize
  } catch (error) {
    log.error('Failed to navigate to environment', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorRecorder',
      environmentUrl,
    });
    throw new Error(`Failed to navigate to ${environmentUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check if 'login' is in the page keywords - if so, record login page before logging in
  const loginKeywordIndex = pageKeywords.findIndex(kw =>
    kw.toLowerCase().includes('login') ||
    kw.toLowerCase().includes('signin') ||
    kw.toLowerCase().includes('auth')
  );

  let loginPageRecorded = false;
  if (loginKeywordIndex >= 0 && credentials && credentials.username && credentials.password) {
    const loginKeyword = pageKeywords[loginKeywordIndex];

    // Derive the actual page name from the current URL (what the test executor will use)
    const currentUrl = page.url();
    const urlPageName = inferPageNameFromUrl(currentUrl);

    log.debug('Recording login page before authentication', {
      module: 'SelectorRecorder',
      loginKeyword,
      urlPageName,
      currentUrl,
    });

    // Record selectors on the login page BEFORE logging in
    const loginPageElements = await discoverPageElements(page, loginKeyword);

    // Use the URL-derived page name for selector mapping (this is what test executor expects)
    const pageName = urlPageName || loginKeyword;

    // Create login page journey
    const loginJourney: PageJourney = {
      pageKeyword: loginKeyword,
      actualUrl: currentUrl,
      startingUrl: environmentUrl,
      steps: [],
      selectors: loginPageElements,
      discoveredAt: new Date().toISOString(),
      environmentSlug,
    };

    // Save login journey with selectors
    await addOrUpdateJourney(environmentSlug, loginJourney);

    // Save login page selector mapping with URL-derived page name
    const loginMapping: SelectorMapping = {
      page: pageName,
      description: `Selectors for ${loginKeyword} page (URL path: ${pageName}) at ${currentUrl}`,
      elements: loginPageElements,
      version: '1.0',
      lastUpdated: new Date().toISOString(),
    };

    const loginFilePath = await saveSelectorMapping(loginMapping, environmentSlug);

    results.push({
      page: pageName,
      elementsRecorded: Object.keys(loginPageElements).length,
      filePath: loginFilePath,
      success: true,
    });

    loginPageRecorded = true;

    log.debug('Login page selectors recorded', {
      module: 'SelectorRecorder',
      pageName,
      elementCount: Object.keys(loginPageElements).length,
      filePath: loginFilePath,
    });

    // Remove login keyword from discovery list since we've already recorded it
    pageKeywords = pageKeywords.filter((_, index) => index !== loginKeywordIndex);
  }

  // If on login page and credentials provided, perform login
  let loginSuccessful = false;
  if (credentials && credentials.username && credentials.password) {
    const loginJourney = await performLoginWithJourney(page, credentials, environmentUrl, environmentSlug);
    if (loginJourney) {
      // Save login journey
      await setLoginJourney(environmentSlug, loginJourney);
      loginSuccessful = true;
      log.debug('Login journey recorded', {
        module: 'SelectorRecorder',
        loginUrl: loginJourney.actualUrl,
      });
    }
  }

  // Get current URL after login (this is the starting point for discovery)
  const startingUrl = page.url();

  // ALWAYS call discoverPages - it will discover ALL navigation if keywords array is empty
  log.debug('Starting page discovery', {
    module: 'SelectorRecorder',
    keywordsProvided: pageKeywords.length,
    mode: pageKeywords.length > 0 ? 'targeted' : 'discover_all',
  });

  const discoveredJourneys = await discoverPages(
    page,
    environmentUrl,
    pageKeywords,  // Empty array = discover ALL navigation
    environmentSlug,
    10 // max pages
  );

  log.debug('Page discovery complete', {
    module: 'SelectorRecorder',
    discoveredCount: discoveredJourneys.length,
  });

  // Record selectors for each discovered page
  for (const journey of discoveredJourneys) {
    try {
      // Navigate to the page using its journey
      await navigateUsingJourney(page, journey);

      // Discover elements on this page
      const elements = await discoverPageElements(page, journey.pageKeyword);

      // Update journey with selectors
      journey.selectors = elements;

      // Save journey to repository
      await addOrUpdateJourney(environmentSlug, journey);

      // NEW: Extract and save navigation selector to database
      // This stores the selector that leads TO this page (for smart navigation)
      if (journey.steps.length > 0 && journey.steps[0].targetSelector) {
        const navStep = journey.steps[0];
        const sourcePageName = inferPageNameFromUrl(journey.startingUrl);
        const navElementKey = `nav${journey.pageKeyword.charAt(0).toUpperCase()}${journey.pageKeyword.slice(1)}`;

        // Create ElementSelector object for the navigation element
        const navSelector = {
          key: navElementKey,
          primary: navStep.targetSelector,
          fallbacks: [], // Could extract more fallbacks from navigation item if available
          metadata: {
            type: 'navigation',
            label: journey.navigationItemText || journey.pageKeyword,
            description: `Navigation link to ${journey.pageKeyword} page`,
          },
        };

        log.debug('Saving navigation selector', {
          module: 'SelectorRecorder',
          sourcePageName,
          navElementKey,
          leadsToPage: journey.pageKeyword,
          discoveredUrl: journey.actualUrl,
          selector: navStep.targetSelector,
        });

        // This will be saved to database by the API route
        // Store it in the journey so the API can access it
        (journey as any).navigationSelector = {
          sourcePageName,
          navElementKey,
          navSelector,
          leadsToPage: journey.pageKeyword,
          discoveredUrl: journey.actualUrl,
        };
      }

      // Create selector mapping
      const mapping: SelectorMapping = {
        page: journey.pageKeyword,
        description: `Selectors for ${journey.pageKeyword} page (discovered at ${journey.actualUrl})`,
        elements,
        version: '1.0',
        lastUpdated: new Date().toISOString(),
      };

      // Save selector mapping to file
      const filePath = await saveSelectorMapping(mapping, environmentSlug);

      results.push({
        page: journey.pageKeyword,
        elementsRecorded: Object.keys(elements).length,
        filePath,
        success: true,
      });

      journeys.push(journey);

      log.debug('Recorded selectors for discovered page', {
        module: 'SelectorRecorder',
        pageKeyword: journey.pageKeyword,
        actualUrl: journey.actualUrl,
        elementCount: Object.keys(elements).length,
      });

    } catch (error) {
      log.error('Failed to record selectors for journey', error instanceof Error ? error : new Error(String(error)), {
        module: 'SelectorRecorder',
        pageKeyword: journey.pageKeyword,
      });
      results.push({
        page: journey.pageKeyword,
        elementsRecorded: 0,
        filePath: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log.debug('Journey-based recording complete', {
    module: 'SelectorRecorder',
    totalJourneys: journeys.length,
    successfulRecordings: results.filter(r => r.success).length,
  });

  return { results, journeys };
}

/**
 * Navigate to a page using its journey
 */
async function navigateUsingJourney(
  page: Page,
  journey: PageJourney
): Promise<void> {
  log.debug('Navigating using journey', {
    module: 'SelectorRecorder',
    pageKeyword: journey.pageKeyword,
    stepCount: journey.steps.length,
  });

  // If journey has no steps, just navigate directly
  if (journey.steps.length === 0) {
    await page.goto(journey.actualUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    return;
  }

  // Execute each step in the journey
  for (const step of journey.steps) {
    switch (step.action) {
      case 'navigate':
        if (step.expectedUrl) {
          await page.goto(step.expectedUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        }
        break;

      case 'click':
        if (step.targetSelector) {
          await page.waitForSelector(step.targetSelector, { state: 'visible', timeout: 5000 });

          // Capture URL before navigation
          const urlBeforeClick = page.url();

          // Click the element
          await page.click(step.targetSelector);

          // Wait for URL change with timeout (handles real navigation)
          try {
            await page.waitForURL(
              (url) => url.toString() !== urlBeforeClick,
              { waitUntil: 'domcontentloaded', timeout: 5000 }
            );
            log.debug('URL changed after journey step click', {
              module: 'SelectorRecorder',
              from: urlBeforeClick,
              to: page.url()
            });
          } catch {
            // URL didn't change - might be modal/SPA, wait for network to stabilize
            await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {
              // If networkidle times out, that's okay
              log.debug('Network idle timeout during journey execution, continuing anyway', {
                module: 'SelectorRecorder',
              });
            });
            log.debug('URL unchanged after journey step, waited for network idle', {
              module: 'SelectorRecorder',
              url: page.url()
            });
          }

          // Additional stability wait to ensure page is fully rendered
          await page.waitForTimeout(500);
        }
        break;

      case 'wait':
        await page.waitForTimeout(step.timeout || 1000);
        break;

      case 'hover':
        if (step.targetSelector) {
          await page.hover(step.targetSelector);
        }
        break;
    }
  }

  log.debug('Journey navigation complete', {
    module: 'SelectorRecorder',
    finalUrl: page.url(),
  });
}

/**
 * Perform login and record it as a journey
 */
async function performLoginWithJourney(
  page: Page,
  credentials: EnvironmentCredentials,
  environmentUrl: string,
  environmentSlug: string
): Promise<PageJourney | null> {
  log.debug('Attempting login with journey recording', { module: 'SelectorRecorder' });

  const startingUrl = page.url();
  const steps: PageJourney['steps'] = [];

  try {
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Record current state
    const beforeLoginUrl = page.url();

    // Perform login (using existing logic)
    await performLogin(page, credentials);

    // Get URL after login
    const afterLoginUrl = page.url();

    // Create login journey
    const loginJourney: PageJourney = {
      pageKeyword: 'login',
      actualUrl: beforeLoginUrl,
      startingUrl: environmentUrl,
      steps: [
        {
          action: 'navigate',
          description: 'Navigate to login page',
          expectedUrl: beforeLoginUrl,
        },
      ],
      selectors: {}, // Will be filled later if needed
      discoveredAt: new Date().toISOString(),
      environmentSlug,
    };

    log.debug('Login journey created', {
      module: 'SelectorRecorder',
      beforeLogin: beforeLoginUrl,
      afterLogin: afterLoginUrl,
    });

    return loginJourney;

  } catch (error) {
    log.error('Failed to create login journey', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorRecorder',
    });
    return null;
  }
}

/**
 * Perform login using credentials
 */
async function performLogin(
  page: Page,
  credentials: EnvironmentCredentials
): Promise<void> {
  log.debug('Attempting login', { module: 'SelectorRecorder' });

  try {
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Try to find email/username field
    const emailSelectors = [
      'input[type="email"]',
      'input[name*="email" i]',
      'input[name*="username" i]',
      'input[id*="email" i]',
      'input[id*="username" i]',
      'input[placeholder*="email" i]',
      'input[placeholder*="username" i]',
    ];

    let emailField = null;
    for (const selector of emailSelectors) {
      emailField = page.locator(selector).first();
      if (await emailField.isVisible().catch(() => false)) {
        break;
      }
    }

    if (!emailField || !await emailField.isVisible().catch(() => false)) {
      log.warn('Could not find email/username field', { module: 'SelectorRecorder' });
      return;
    }

    // Fill email
    await emailField.fill(credentials.username);
    await page.waitForTimeout(500);

    // Try to find password field
    const passwordSelectors = [
      'input[type="password"]',
      'input[name*="password" i]',
      'input[id*="password" i]',
    ];

    let passwordField = null;
    for (const selector of passwordSelectors) {
      passwordField = page.locator(selector).first();
      if (await passwordField.isVisible().catch(() => false)) {
        break;
      }
    }

    if (!passwordField || !await passwordField.isVisible().catch(() => false)) {
      log.warn('Could not find password field', { module: 'SelectorRecorder' });
      return;
    }

    // Fill password
    await passwordField.fill(credentials.password);
    await page.waitForTimeout(500);

    // Try to find and click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      'button:has-text("Log In")',
      'input[type="submit"]',
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
      submitButton = page.locator(selector).first();
      if (await submitButton.isVisible().catch(() => false)) {
        break;
      }
    }

    if (submitButton && await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000); // Wait for navigation

      log.debug('Login completed successfully', { module: 'SelectorRecorder' });
    } else {
      log.warn('Could not find submit button', { module: 'SelectorRecorder' });
    }
  } catch (error) {
    log.error('Login failed', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorRecorder',
    });
    // Continue anyway - maybe already logged in or login not needed
  }
}

/**
 * Record selectors for a single page
 */
async function recordPageSelectors(
  page: Page,
  pageName: string,
  environmentUrl: string,
  environmentSlug: string,
  storyKey?: string
): Promise<SelectorRecordingResult> {
  log.debug('Recording selectors for page', {
    module: 'SelectorRecorder',
    pageName,
  });

  // Navigate to page if not already there
  await navigateToPage(page, pageName, environmentUrl);

  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Discover interactive elements
  const elements = await discoverPageElements(page, pageName);

  // Create selector mapping
  const mapping: SelectorMapping = {
    page: pageName,
    description: `Selectors for ${pageName} page`,
    elements,
    version: '1.0',
    lastUpdated: new Date().toISOString(),
  };

  // Save to file
  const filePath = await saveSelectorMapping(mapping, environmentSlug);

  return {
    page: pageName,
    elementsRecorded: Object.keys(elements).length,
    filePath,
    success: true,
  };
}

/**
 * Navigate to a specific page
 */
async function navigateToPage(
  page: Page,
  pageName: string,
  environmentUrl: string
): Promise<void> {
  const currentUrl = page.url();

  // Simple heuristic: if page name is in URL, we might already be there
  if (currentUrl.toLowerCase().includes(pageName.toLowerCase())) {
    log.debug('Already on target page', { module: 'SelectorRecorder', pageName, currentUrl });
    return;
  }

  // Try common URL patterns
  const urlsToTry = [
    `${environmentUrl}/${pageName}`,
    `${environmentUrl}/${pageName.toLowerCase()}`,
    `${environmentUrl}/${pageName}s`, // plural
  ];

  for (const url of urlsToTry) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      log.debug('Navigated to page', { module: 'SelectorRecorder', pageName, url });
      return;
    } catch (error) {
      // Try next URL
      continue;
    }
  }

  // If navigation failed, stay on current page
  log.warn('Could not navigate to page, staying on current page', {
    module: 'SelectorRecorder',
    pageName,
    currentUrl,
  });
}

/**
 * Discover interactive elements on a page
 */
async function discoverPageElements(
  page: Page,
  pageName: string
): Promise<Record<string, ElementSelector>> {
  const elements: Record<string, ElementSelector> = {};

  // Discover buttons
  const buttons = await page.locator('button').all();
  for (let i = 0; i < Math.min(buttons.length, 20); i++) { // Limit to 20 per type
    const button = buttons[i];
    const text = await button.textContent().catch(() => '');
    const ariaLabel = await button.getAttribute('aria-label').catch(() => null);
    const name = await button.getAttribute('name').catch(() => null);

    const elementKey = generateElementKey('button', text || ariaLabel || name || `${i}`);
    const selector = await generateSelector(button, 'button');

    elements[elementKey] = {
      key: elementKey,
      primary: selector.primary,
      fallbacks: selector.fallbacks,
      metadata: {
        type: 'button',
        label: text || ariaLabel || undefined,
        description: `Button: ${text || ariaLabel || 'unlabeled'}`,
      },
    };
  }

  // Discover inputs
  const inputs = await page.locator('input').all();
  for (let i = 0; i < Math.min(inputs.length, 20); i++) {
    const input = inputs[i];
    const type = await input.getAttribute('type').catch(() => 'text');
    const name = await input.getAttribute('name').catch(() => null);
    const placeholder = await input.getAttribute('placeholder').catch(() => null);
    const id = await input.getAttribute('id').catch(() => null);

    const elementKey = generateElementKey('input', name || id || placeholder || `${i}`);
    const selector = await generateSelector(input, 'input');

    elements[elementKey] = {
      key: elementKey,
      primary: selector.primary,
      fallbacks: selector.fallbacks,
      metadata: {
        type: 'input',
        placeholder: placeholder || undefined,
        name: name || undefined,
        label: placeholder || name || undefined,
        description: `Input field: ${placeholder || name || type || 'text'}`,
      },
    };
  }

  // Discover links
  const links = await page.locator('a[href]').all();
  for (let i = 0; i < Math.min(links.length, 15); i++) {
    const link = links[i];
    const text = await link.textContent().catch(() => '');
    const href = await link.getAttribute('href').catch(() => '');

    const elementKey = generateElementKey('link', text || `${i}`);
    const selector = await generateSelector(link, 'link');

    elements[elementKey] = {
      key: elementKey,
      primary: selector.primary,
      fallbacks: selector.fallbacks,
      metadata: {
        type: 'link',
        text: text || undefined,
        description: `Link: ${text || href}`,
      },
    };
  }

  log.debug('Discovered elements', {
    module: 'SelectorRecorder',
    pageName,
    count: Object.keys(elements).length,
  });

  return elements;
}

/**
 * Generate a unique element key from type and identifier
 */
function generateElementKey(type: string, identifier: string): string {
  const normalized = identifier
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .substring(0, 30); // Limit length

  return `${type}${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

/**
 * Generate selector strategies for an element
 */
async function generateSelector(
  element: any,
  type: string
): Promise<{ primary: string; fallbacks: string[] }> {
  const fallbacks: string[] = [];

  // Try to get various attributes
  const id = await element.getAttribute('id').catch(() => null);
  const name = await element.getAttribute('name').catch(() => null);
  const ariaLabel = await element.getAttribute('aria-label').catch(() => null);
  const className = await element.getAttribute('class').catch(() => null);

  // Primary: Use ID if available
  let primary = '';
  if (id) {
    primary = `#${id}`;
    if (name) fallbacks.push(`[name="${name}"]`);
  } else if (name) {
    primary = `[name="${name}"]`;
    if (id) fallbacks.push(`#${id}`);
  } else if (ariaLabel) {
    primary = `[aria-label="${ariaLabel}"]`;
  } else {
    // Fallback to tag + class
    primary = type;
    if (className) {
      const firstClass = className.split(' ')[0];
      primary = `${type}.${firstClass}`;
    }
  }

  // Add aria-label as fallback if not primary
  if (ariaLabel && !primary.includes('aria-label')) {
    fallbacks.push(`[aria-label="${ariaLabel}"]`);
  }

  // Add class-based fallback
  if (className && !primary.includes(className.split(' ')[0])) {
    fallbacks.push(`${type}.${className.split(' ')[0]}`);
  }

  return {
    primary: primary || type,
    fallbacks: fallbacks.slice(0, 3), // Limit to 3 fallbacks
  };
}

/**
 * Save selector mapping to file
 */
async function saveSelectorMapping(
  mapping: SelectorMapping,
  environmentSlug: string
): Promise<string> {
  const selectorsDir = path.join(process.cwd(), 'selectors', 'environments', environmentSlug);
  const filePath = path.join(selectorsDir, `${mapping.page}.json`);

  // Ensure directory exists
  await fs.mkdir(selectorsDir, { recursive: true });

  // Write file
  await fs.writeFile(filePath, JSON.stringify(mapping, null, 2), 'utf-8');

  log.debug('Saved selector mapping', {
    module: 'SelectorRecorder',
    filePath,
    elementCount: Object.keys(mapping.elements).length,
  });

  return filePath;
}

/**
 * Create metadata for recorded pages
 */
export function createPageMetadata(
  results: SelectorRecordingResult[],
  storyKey?: string
): Record<string, PageRecordingMetadata> {
  const metadata: Record<string, PageRecordingMetadata> = {};

  for (const result of results) {
    if (result.success) {
      metadata[result.page] = {
        recordedAt: new Date().toISOString(),
        recordedBy: storyKey,
        elementCount: result.elementsRecorded,
        lastValidated: null,
      };
    }
  }

  return metadata;
}
