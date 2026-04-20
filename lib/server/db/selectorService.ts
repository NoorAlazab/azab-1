/**
 * Selector Service
 * Handles database operations for page selectors and journeys
 */

import { prisma } from './prisma';
import { log } from '@/lib/shared/utils/logger';
import type { ElementSelector, SelectorMapping } from '@/types/selectors';
import { normalizePageKeyword } from '@/lib/shared/utils/pageKeywordNormalizer';

// Navigation step type
export interface NavigationStep {
  action: string;
  target?: string;
  url?: string;
  value?: string;
}

/**
 * Save discovered elements to database
 * Replaces existing selectors for the page (except navigation elements)
 */
export async function saveSelectorsToDatabase(
  environmentConfigId: string,
  pageName: string,
  pageUrl: string,
  elements: Record<string, ElementSelector>,
  storyKey?: string
): Promise<void> {
  try {
    // Delete existing selectors for this page (but NOT navigation elements)
    await prisma.pageSelector.deleteMany({
      where: {
        environmentConfigId,
        pageName,
        isNavigationElement: false,  // Only delete regular elements
      },
    });

    // Prepare selector records
    const selectorRecords = Object.values(elements).map(el => ({
      environmentConfigId,
      pageName,
      pageUrl,
      elementKey: el.key,
      primarySelector: el.primary,
      fallbackSelectors: el.fallbacks,
      elementType: el.metadata.type,
      elementMetadata: el.metadata as any,
      recordedBy: storyKey,
      isNavigationElement: false,  // Regular page elements, not navigation
    }));

    // Insert all new selectors
    if (selectorRecords.length > 0) {
      await prisma.pageSelector.createMany({
        data: selectorRecords,
      });
    }

    log.info('Saved selectors to database', {
      module: 'SelectorService',
      environmentConfigId,
      pageName,
      pageUrl,
      count: selectorRecords.length,
      storyKey,
    });
  } catch (error) {
    log.error('Failed to save selectors to database', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
      pageName,
    });
    throw error;
  }
}

/**
 * Save navigation journey to database
 * Upserts journey (creates or updates)
 */
export async function saveJourneyToDatabase(
  environmentConfigId: string,
  fromPage: string,
  toPage: string,
  steps: NavigationStep[]
): Promise<void> {
  try {
    await prisma.pageJourney.upsert({
      where: {
        environmentConfigId_fromPage_toPage: {
          environmentConfigId,
          fromPage,
          toPage,
        },
      },
      update: {
        navigationSteps: steps as any,
      },
      create: {
        environmentConfigId,
        fromPage,
        toPage,
        navigationSteps: steps as any,
      },
    });

    log.info('Saved journey to database', {
      module: 'SelectorService',
      environmentConfigId,
      fromPage,
      toPage,
      stepsCount: steps.length,
    });
  } catch (error) {
    log.error('Failed to save journey to database', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
      fromPage,
      toPage,
    });
    throw error;
  }
}

/**
 * Load selectors from database for test execution
 * Returns null if no selectors found
 */
export async function loadSelectorsFromDatabase(
  environmentConfigId: string,
  pageName: string
): Promise<SelectorMapping | null> {
  try {
    const selectors = await prisma.pageSelector.findMany({
      where: {
        environmentConfigId,
        pageName,
      },
      orderBy: {
        recordedAt: 'desc',
      },
    });

    if (selectors.length === 0) {
      log.debug('No selectors found in database', {
        module: 'SelectorService',
        environmentConfigId,
        pageName,
      });
      return null;
    }

    // Convert DB records to SelectorMapping format
    const elements: Record<string, ElementSelector> = {};
    selectors.forEach(sel => {
      elements[sel.elementKey] = {
        key: sel.elementKey,
        primary: sel.primarySelector,
        fallbacks: sel.fallbackSelectors as string[],
        metadata: sel.elementMetadata as any,
      };
    });

    const mapping: SelectorMapping = {
      page: pageName,
      description: `Selectors for ${pageName} (loaded from database)`,
      elements,
      version: '1.0',
      lastUpdated: selectors[0].recordedAt.toISOString(),
    };

    log.debug('Loaded selectors from database', {
      module: 'SelectorService',
      environmentConfigId,
      pageName,
      elementCount: Object.keys(elements).length,
    });

    return mapping;
  } catch (error) {
    log.error('Failed to load selectors from database', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
      pageName,
    });
    return null;
  }
}

/**
 * Load journey from database
 * Returns null if journey not found
 */
export async function loadJourneyFromDatabase(
  environmentConfigId: string,
  fromPage: string,
  toPage: string
): Promise<NavigationStep[] | null> {
  try {
    const journey = await prisma.pageJourney.findUnique({
      where: {
        environmentConfigId_fromPage_toPage: {
          environmentConfigId,
          fromPage,
          toPage,
        },
      },
    });

    if (!journey) {
      log.debug('No journey found in database', {
        module: 'SelectorService',
        environmentConfigId,
        fromPage,
        toPage,
      });
      return null;
    }

    log.debug('Loaded journey from database', {
      module: 'SelectorService',
      environmentConfigId,
      fromPage,
      toPage,
      stepsCount: (journey.navigationSteps as any[]).length,
    });

    return journey.navigationSteps as unknown as NavigationStep[];
  } catch (error) {
    log.error('Failed to load journey from database', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
      fromPage,
      toPage,
    });
    return null;
  }
}

/**
 * Get all pages recorded for an environment
 */
export async function getRecordedPagesFromDatabase(
  environmentConfigId: string
): Promise<string[]> {
  try {
    const selectors = await prisma.pageSelector.findMany({
      where: {
        environmentConfigId,
      },
      select: {
        pageName: true,
      },
      distinct: ['pageName'],
    });

    const pageNames = selectors.map(s => s.pageName);

    log.debug('Retrieved recorded pages from database', {
      module: 'SelectorService',
      environmentConfigId,
      pages: pageNames,
    });

    return pageNames;
  } catch (error) {
    log.error('Failed to get recorded pages', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
    });
    return [];
  }
}

/**
 * Check if selectors exist for a page
 */
export async function hasSelectorsForPage(
  environmentConfigId: string,
  pageName: string
): Promise<boolean> {
  try {
    const count = await prisma.pageSelector.count({
      where: {
        environmentConfigId,
        pageName,
      },
    });

    return count > 0;
  } catch (error) {
    log.error('Failed to check selectors', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
      pageName,
    });
    return false;
  }
}

/**
 * Delete all selectors for a page
 */
export async function deleteSelectorsForPage(
  environmentConfigId: string,
  pageName: string
): Promise<void> {
  try {
    await prisma.pageSelector.deleteMany({
      where: {
        environmentConfigId,
        pageName,
      },
    });

    log.info('Deleted selectors for page', {
      module: 'SelectorService',
      environmentConfigId,
      pageName,
    });
  } catch (error) {
    log.error('Failed to delete selectors', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
      pageName,
    });
    throw error;
  }
}

/**
 * Get statistics about recorded selectors
 */
export async function getSelectorStats(
  environmentConfigId: string
): Promise<{
  totalPages: number;
  totalElements: number;
  pageStats: { pageName: string; elementCount: number; lastRecorded: Date }[];
}> {
  try {
    const selectors = await prisma.pageSelector.findMany({
      where: {
        environmentConfigId,
      },
      select: {
        pageName: true,
        recordedAt: true,
      },
    });

    const pageMap = new Map<string, { count: number; lastRecorded: Date }>();

    selectors.forEach(sel => {
      const existing = pageMap.get(sel.pageName);
      if (!existing || sel.recordedAt > existing.lastRecorded) {
        pageMap.set(sel.pageName, {
          count: (existing?.count || 0) + 1,
          lastRecorded: sel.recordedAt,
        });
      } else {
        pageMap.set(sel.pageName, {
          count: existing.count + 1,
          lastRecorded: existing.lastRecorded,
        });
      }
    });

    const pageStats = Array.from(pageMap.entries()).map(([pageName, stats]) => ({
      pageName,
      elementCount: stats.count,
      lastRecorded: stats.lastRecorded,
    }));

    return {
      totalPages: pageMap.size,
      totalElements: selectors.length,
      pageStats,
    };
  } catch (error) {
    log.error('Failed to get selector stats', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
    });
    return {
      totalPages: 0,
      totalElements: 0,
      pageStats: [],
    };
  }
}

/**
 * Save a navigation selector to database
 * This saves the selector that leads FROM one page TO another
 */
export async function saveNavigationSelector(
  environmentConfigId: string,
  sourcePageName: string,
  navElementKey: string,
  navSelector: ElementSelector,
  leadsToPage: string,
  discoveredUrl: string,
  storyKey?: string
): Promise<void> {
  try {
    console.log('Saving navigation selector:', navSelector)
    await prisma.pageSelector.upsert({
      where: {
        environmentConfigId_pageName_elementKey: {
          environmentConfigId,
          pageName: sourcePageName,
          elementKey: navElementKey,
        },
      },
      create: {
        environmentConfigId,
        pageName: sourcePageName,
        pageUrl: '', // Not applicable for nav elements
        elementKey: navElementKey,
        primarySelector: navSelector.primary,
        fallbackSelectors: navSelector.fallbacks,
        elementType: 'navigation',
        elementMetadata: navSelector.metadata as any,
        recordedBy: storyKey,
        isNavigationElement: true,
        leadsToPage,
        sourcePageName,
        discoveredUrl,
        urlLastVerified: new Date(),
        urlVerificationCount: 1,
      },
      update: {
        // Update selector and URL if re-recording
        primarySelector: navSelector.primary,
        fallbackSelectors: navSelector.fallbacks,
        elementMetadata: navSelector.metadata as any,
        discoveredUrl,
        urlLastVerified: new Date(),
        urlVerificationCount: { increment: 1 },
      },
    });

    log.info('Saved navigation selector to database', {
      module: 'SelectorService',
      environmentConfigId,
      sourcePageName,
      navElementKey,
      leadsToPage,
      discoveredUrl,
    });
  } catch (error) {
    log.error('Failed to save navigation selector', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      sourcePageName,
      navElementKey,
      leadsToPage,
    });
    throw error;
  }
}

/**
 * Load navigation data (selector + cached URL) for navigation from one page to another
 */
export async function loadNavigationData(
  environmentConfigId: string,
  fromPage: string,
  toPage: string
): Promise<{
  selector: ElementSelector;
  cachedUrl?: string;
  urlReliability: number;  // 0-1 score based on verification count
} | null> {
  try {
    // CRITICAL: Normalize keywords to match database entries saved with/without normalization
    // This allows finding old "log in" entries when searching for "login"
    const normalizedFrom = normalizePageKeyword(fromPage);
    const normalizedTo = normalizePageKeyword(toPage);

    log.debug('Looking up navigation data with normalized keywords', {
      module: 'SelectorService',
      fromPage,
      normalizedFrom,
      toPage,
      normalizedTo,
    });

    // STRATEGY 1: Try exact match with normalized keywords (for new recordings)
    let navElement = await prisma.pageSelector.findFirst({
      where: {
        environmentConfigId,
        pageName: normalizedFrom,
        isNavigationElement: true,
        leadsToPage: normalizedTo,
      },
    });

    // STRATEGY 2: If not found, fetch all navigation from this page and normalize in code
    // This finds old "log in" entries when searching for "login"
    if (!navElement) {
      log.debug('Exact match not found, trying fuzzy match with normalization', {
        module: 'SelectorService',
        normalizedFrom,
        normalizedTo,
      });

      const allNavFromPage = await prisma.pageSelector.findMany({
        where: {
          environmentConfigId,
          isNavigationElement: true,
        },
      });

      log.debug('Loaded navigation selectors for fuzzy matching', {
        module: 'SelectorService',
        count: allNavFromPage.length,
      });

      // Find by normalizing both pageName and leadsToPage
      navElement = allNavFromPage.find(el => {
        const normalizedPageName = normalizePageKeyword(el.pageName);
        const normalizedLeadsTo = el.leadsToPage ? normalizePageKeyword(el.leadsToPage) : '';

        const pageNameMatches = normalizedPageName === normalizedFrom;
        const leadsToMatches = el.leadsToPage && normalizedLeadsTo === normalizedTo;

        return pageNameMatches && leadsToMatches;
      }) || null;

      if (navElement) {
        log.debug('Found navigation selector via fuzzy match', {
          module: 'SelectorService',
          originalPageName: navElement.pageName,
          originalLeadsToPage: navElement.leadsToPage,
          normalizedFrom,
          normalizedTo,
        });
      }
    }

    if (!navElement) {
      log.debug('No navigation selector found (tried exact and fuzzy match)', {
        module: 'SelectorService',
        environmentConfigId,
        fromPage,
        toPage,
      });
      return null;
    }

    // Calculate reliability score: 0 to 1 based on verification count
    // 10 verifications = 100% reliable
    const reliability = Math.min(navElement.urlVerificationCount / 10, 1);

    const navData = {
      selector: {
        key: navElement.elementKey,
        primary: navElement.primarySelector,
        fallbacks: navElement.fallbackSelectors as string[],
        metadata: navElement.elementMetadata as any,
      },
      cachedUrl: navElement.discoveredUrl || undefined,
      urlReliability: reliability,
    };

    log.debug('Loaded navigation data from database', {
      module: 'SelectorService',
      environmentConfigId,
      fromPage,
      toPage,
      selectorKey: navData.selector.key,
      hasCachedUrl: !!navData.cachedUrl,
      reliability,
    });

    return navData;
  } catch (error) {
    log.error('Failed to load navigation data', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
      fromPage,
      toPage,
    });
    return null;
  }
}

/**
 * Update URL verification status
 * Called after attempting to use a cached URL
 */
export async function updateUrlVerification(
  environmentConfigId: string,
  navElementKey: string,
  success: boolean
): Promise<void> {
  try {
    if (success) {
      // Increment verification count and update last verified time
      await prisma.pageSelector.updateMany({
        where: {
          environmentConfigId,
          elementKey: navElementKey,
          isNavigationElement: true,
        },
        data: {
          urlLastVerified: new Date(),
          urlVerificationCount: { increment: 1 },
        },
      });

      log.debug('Incremented URL verification count', {
        module: 'SelectorService',
        environmentConfigId,
        navElementKey,
      });
    } else {
      // Decrement verification count (but don't go below 0)
      const navElement = await prisma.pageSelector.findFirst({
        where: {
          environmentConfigId,
          elementKey: navElementKey,
          isNavigationElement: true,
        },
      });

      if (navElement && navElement.urlVerificationCount > 0) {
        await prisma.pageSelector.updateMany({
          where: {
            environmentConfigId,
            elementKey: navElementKey,
            isNavigationElement: true,
          },
          data: {
            urlVerificationCount: { decrement: 1 },
          },
        });

        log.debug('Decremented URL verification count', {
          module: 'SelectorService',
          environmentConfigId,
          navElementKey,
        });
      }
    }
  } catch (error) {
    log.error('Failed to update URL verification', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
      navElementKey,
    });
  }
}

/**
 * Update cached URL for a navigation element
 * Called when selector-based navigation discovers a new or changed URL
 */
export async function updateCachedUrl(
  environmentConfigId: string,
  navElementKey: string,
  newUrl: string
): Promise<void> {
  try {
    await prisma.pageSelector.updateMany({
      where: {
        environmentConfigId,
        elementKey: navElementKey,
        isNavigationElement: true,
      },
      data: {
        discoveredUrl: newUrl,
        urlLastVerified: new Date(),
        urlVerificationCount: 1, // Reset count with new URL
      },
    });

    log.info('Updated cached URL for navigation element', {
      module: 'SelectorService',
      environmentConfigId,
      navElementKey,
      newUrl,
    });
  } catch (error) {
    log.error('Failed to update cached URL', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      environmentConfigId,
      navElementKey,
      newUrl,
    });
  }
}

/**
 * Check if selectors already exist for a page
 * Returns cached selectors if they exist, null otherwise
 */
export async function checkExistingSelectors(
  environmentConfigId: string,
  pageKeyword: string
): Promise<{ selectors: any[]; cached: true } | null> {
  try {
    const normalized = normalizePageKeyword(pageKeyword);

    log.debug('Checking for existing selectors', {
      module: 'SelectorService',
      pageKeyword,
      normalized,
      environmentConfigId,
    });

    const selectors = await prisma.pageSelector.findMany({
      where: {
        environmentConfigId,
        pageName: normalized,
        isNavigationElement: false, // Only page selectors, not navigation
      },
    });

    if (selectors.length > 0) {
      log.debug('Found cached selectors for page', {
        module: 'SelectorService',
        pageKeyword: normalized,
        count: selectors.length,
      });
      return { selectors, cached: true };
    }

    log.debug('No cached selectors found for page', {
      module: 'SelectorService',
      pageKeyword: normalized,
    });
    return null;
  } catch (error) {
    log.error('Failed to check existing selectors', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      pageKeyword,
    });
    return null;
  }
}

/**
 * Load all selectors for a page (for execution)
 * Converts database records to ElementSelector mapping
 */
export async function loadPageSelectors(
  environmentConfigId: string,
  pageKeyword: string
): Promise<Record<string, { primary: string; fallbacks: string[]; metadata?: any }> | null> {
  try {
    const normalized = normalizePageKeyword(pageKeyword);

    log.debug('Loading page selectors', {
      module: 'SelectorService',
      pageKeyword,
      normalized,
      environmentConfigId,
    });

    const selectors = await prisma.pageSelector.findMany({
      where: {
        environmentConfigId,
        pageName: normalized,
      },
    });

    if (selectors.length === 0) {
      log.debug('No selectors found for page', {
        module: 'SelectorService',
        pageKeyword: normalized,
      });
      return null;
    }

    // Convert to ElementSelector mapping
    const elementMapping: Record<string, { primary: string; fallbacks: string[]; metadata?: any }> = {};

    for (const selector of selectors) {
      elementMapping[selector.elementKey] = {
        primary: selector.primarySelector,
        fallbacks: (selector.fallbackSelectors as string[]) || [],
        metadata: selector.elementMetadata as any,
      };
    }

    log.debug('Loaded page selectors', {
      module: 'SelectorService',
      pageKeyword: normalized,
      elementCount: Object.keys(elementMapping).length,
    });

    return elementMapping;
  } catch (error) {
    log.error('Failed to load page selectors', error instanceof Error ? error : new Error(String(error)), {
      module: 'SelectorService',
      pageKeyword,
    });
    return null;
  }
}
