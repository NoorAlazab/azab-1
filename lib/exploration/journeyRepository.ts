/**
 * Journey Repository
 * Manages storage and retrieval of page journeys and site maps
 * Provides journey-based navigation instead of hardcoded URL patterns
 */

import type { SiteMap, PageJourney, JourneyStep } from '@/types/journey';
import type { ElementSelector } from '@/types/selectors';
import { log } from '@/lib/utils/logger';
import fs from 'fs';
import path from 'path';

// In-memory cache for site maps
const siteMapCache = new Map<string, SiteMap>();
let cacheEnabled = true;

// Statistics tracking
const stats = {
  totalLoads: 0,
  cacheHits: 0,
  cacheMisses: 0,
  totalSaves: 0,
  journeyFinds: 0,
  journeyNotFound: 0,
};

/**
 * Get the file path for a site map
 */
function getSiteMapPath(environmentSlug: string): string {
  const journeyDir = path.join(process.cwd(), 'journeys', 'environments', environmentSlug);
  return path.join(journeyDir, 'sitemap.json');
}

/**
 * Ensure the directory for site maps exists
 */
function ensureDirectoryExists(environmentSlug: string): void {
  const journeyDir = path.join(process.cwd(), 'journeys', 'environments', environmentSlug);
  if (!fs.existsSync(journeyDir)) {
    fs.mkdirSync(journeyDir, { recursive: true });
    log.debug('Created journey directory', { module: 'JourneyRepository', environmentSlug, path: journeyDir });
  }
}

/**
 * Load site map for an environment
 * Returns null if no site map exists yet
 */
export async function loadSiteMap(environmentSlug: string): Promise<SiteMap | null> {
  stats.totalLoads++;

  // Check cache first
  if (cacheEnabled && siteMapCache.has(environmentSlug)) {
    stats.cacheHits++;
    log.debug('Site map loaded from cache', { module: 'JourneyRepository', environmentSlug });
    return siteMapCache.get(environmentSlug)!;
  }

  stats.cacheMisses++;

  try {
    const filePath = getSiteMapPath(environmentSlug);

    if (!fs.existsSync(filePath)) {
      log.debug('Site map file not found', { module: 'JourneyRepository', environmentSlug, filePath });
      return null;
    }

    // Read and parse file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const siteMap: SiteMap = JSON.parse(fileContent);

    // Validate basic structure
    if (!siteMap.environmentUrl || !siteMap.environmentSlug || !siteMap.pages) {
      throw new Error('Invalid site map: missing required fields (environmentUrl, environmentSlug, pages)');
    }

    // Cache it
    if (cacheEnabled) {
      siteMapCache.set(environmentSlug, siteMap);
    }

    log.debug('Site map loaded', {
      module: 'JourneyRepository',
      environmentSlug,
      pageCount: siteMap.pages.length,
      hasLoginJourney: !!siteMap.loginJourney,
    });

    return siteMap;
  } catch (error) {
    log.error(
      'Failed to load site map',
      error instanceof Error ? error : new Error(String(error)),
      { module: 'JourneyRepository', environmentSlug }
    );
    return null;
  }
}

/**
 * Save site map for an environment
 */
export async function saveSiteMap(siteMap: SiteMap): Promise<boolean> {
  stats.totalSaves++;

  try {
    const environmentSlug = siteMap.environmentSlug;
    ensureDirectoryExists(environmentSlug);

    const filePath = getSiteMapPath(environmentSlug);

    // Update last modified timestamp
    siteMap.lastUpdated = new Date().toISOString();

    // Write to file
    const content = JSON.stringify(siteMap, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');

    // Update cache
    if (cacheEnabled) {
      siteMapCache.set(environmentSlug, siteMap);
    }

    log.debug('Site map saved', {
      module: 'JourneyRepository',
      environmentSlug,
      filePath,
      pageCount: siteMap.pages.length,
    });

    return true;
  } catch (error) {
    log.error(
      'Failed to save site map',
      error instanceof Error ? error : new Error(String(error)),
      { module: 'JourneyRepository', environmentSlug: siteMap.environmentSlug }
    );
    return false;
  }
}

/**
 * Find a journey by page keyword
 * Uses semantic matching to handle variations and synonyms
 */
export async function findJourneyByKeyword(
  environmentSlug: string,
  keyword: string
): Promise<PageJourney | null> {
  stats.journeyFinds++;

  const siteMap = await loadSiteMap(environmentSlug);
  if (!siteMap) {
    stats.journeyNotFound++;
    log.debug('No site map found for environment', { module: 'JourneyRepository', environmentSlug });
    return null;
  }

  const normalizedKeyword = keyword.toLowerCase().trim();

  // Try exact match first
  let journey = siteMap.pages.find(p => p.pageKeyword.toLowerCase() === normalizedKeyword);
  if (journey) {
    log.debug('Found journey by exact keyword match', {
      module: 'JourneyRepository',
      keyword: normalizedKeyword,
      actualUrl: journey.actualUrl,
    });
    return journey;
  }

  // Try alternative keywords
  journey = siteMap.pages.find(p =>
    p.alternativeKeywords?.some(k => k.toLowerCase() === normalizedKeyword)
  );
  if (journey) {
    log.debug('Found journey by alternative keyword', {
      module: 'JourneyRepository',
      keyword: normalizedKeyword,
      actualUrl: journey.actualUrl,
    });
    return journey;
  }

  // Try partial match on page keyword
  journey = siteMap.pages.find(p => p.pageKeyword.toLowerCase().includes(normalizedKeyword));
  if (journey) {
    log.debug('Found journey by partial keyword match', {
      module: 'JourneyRepository',
      keyword: normalizedKeyword,
      actualUrl: journey.actualUrl,
    });
    return journey;
  }

  // Try partial match on navigation item text
  journey = siteMap.pages.find(p =>
    p.navigationItemText?.toLowerCase().includes(normalizedKeyword)
  );
  if (journey) {
    log.debug('Found journey by navigation text match', {
      module: 'JourneyRepository',
      keyword: normalizedKeyword,
      actualUrl: journey.actualUrl,
    });
    return journey;
  }

  stats.journeyNotFound++;
  log.debug('No journey found for keyword', {
    module: 'JourneyRepository',
    keyword: normalizedKeyword,
    availablePages: siteMap.pages.map(p => p.pageKeyword),
  });
  return null;
}

/**
 * Add or update a journey in the site map
 */
export async function addOrUpdateJourney(
  environmentSlug: string,
  journey: PageJourney
): Promise<boolean> {
  let siteMap = await loadSiteMap(environmentSlug);

  if (!siteMap) {
    // Create new site map
    siteMap = {
      environmentUrl: journey.startingUrl.split('/').slice(0, 3).join('/'), // Extract base URL
      environmentSlug,
      pages: [],
      lastUpdated: new Date().toISOString(),
      version: '1.0',
    };
  }

  // Find existing journey for this keyword
  const existingIndex = siteMap.pages.findIndex(
    p => p.pageKeyword.toLowerCase() === journey.pageKeyword.toLowerCase()
  );

  if (existingIndex >= 0) {
    // Update existing journey
    siteMap.pages[existingIndex] = journey;
    log.debug('Updated existing journey', {
      module: 'JourneyRepository',
      pageKeyword: journey.pageKeyword,
      actualUrl: journey.actualUrl,
    });
  } else {
    // Add new journey
    siteMap.pages.push(journey);
    log.debug('Added new journey', {
      module: 'JourneyRepository',
      pageKeyword: journey.pageKeyword,
      actualUrl: journey.actualUrl,
    });
  }

  return await saveSiteMap(siteMap);
}

/**
 * Update selectors for a journey
 */
export async function updateJourneySelectors(
  environmentSlug: string,
  pageKeyword: string,
  selectors: Record<string, ElementSelector>
): Promise<boolean> {
  const siteMap = await loadSiteMap(environmentSlug);
  if (!siteMap) {
    log.warn('Cannot update selectors: site map not found', {
      module: 'JourneyRepository',
      environmentSlug,
    });
    return false;
  }

  const journey = siteMap.pages.find(
    p => p.pageKeyword.toLowerCase() === pageKeyword.toLowerCase()
  );

  if (!journey) {
    log.warn('Cannot update selectors: journey not found', {
      module: 'JourneyRepository',
      environmentSlug,
      pageKeyword,
    });
    return false;
  }

  // Update selectors
  journey.selectors = selectors;
  journey.discoveredAt = new Date().toISOString(); // Update timestamp

  log.debug('Updated journey selectors', {
    module: 'JourneyRepository',
    pageKeyword,
    selectorCount: Object.keys(selectors).length,
  });

  return await saveSiteMap(siteMap);
}

/**
 * Set the login journey for a site map
 */
export async function setLoginJourney(
  environmentSlug: string,
  loginJourney: PageJourney
): Promise<boolean> {
  let siteMap = await loadSiteMap(environmentSlug);

  if (!siteMap) {
    // Create new site map
    siteMap = {
      environmentUrl: loginJourney.startingUrl.split('/').slice(0, 3).join('/'),
      environmentSlug,
      pages: [],
      lastUpdated: new Date().toISOString(),
      version: '1.0',
    };
  }

  siteMap.loginJourney = loginJourney;

  log.debug('Set login journey', {
    module: 'JourneyRepository',
    environmentSlug,
    loginUrl: loginJourney.actualUrl,
  });

  return await saveSiteMap(siteMap);
}

/**
 * Get all available site map slugs
 */
export function getAllEnvironmentSlugs(): string[] {
  const journeyDir = path.join(process.cwd(), 'journeys', 'environments');

  if (!fs.existsSync(journeyDir)) {
    return [];
  }

  const entries = fs.readdirSync(journeyDir, { withFileTypes: true });
  const slugs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  return slugs;
}

/**
 * Get all journeys for an environment
 */
export async function getAllJourneys(environmentSlug: string): Promise<PageJourney[]> {
  const siteMap = await loadSiteMap(environmentSlug);
  return siteMap?.pages || [];
}

/**
 * Clear a specific site map from cache
 */
export function clearCacheForEnvironment(environmentSlug: string): void {
  siteMapCache.delete(environmentSlug);
  log.debug('Site map cache cleared for environment', {
    module: 'JourneyRepository',
    environmentSlug,
  });
}

/**
 * Clear all cached site maps
 */
export function clearCache(): void {
  siteMapCache.clear();
  log.debug('All site map caches cleared', { module: 'JourneyRepository' });
}

/**
 * Get repository statistics
 */
export function getStats() {
  return {
    ...stats,
    cacheHitRate: stats.totalLoads > 0 ? (stats.cacheHits / stats.totalLoads) * 100 : 0,
    journeyFindSuccessRate:
      stats.journeyFinds > 0
        ? ((stats.journeyFinds - stats.journeyNotFound) / stats.journeyFinds) * 100
        : 0,
  };
}

/**
 * Configure the journey repository
 */
export function configure(config: { enableCache?: boolean }): void {
  if (config.enableCache !== undefined) {
    cacheEnabled = config.enableCache;
  }

  log.debug('Journey repository configured', {
    module: 'JourneyRepository',
    config,
  });
}

/**
 * Delete a site map for an environment
 */
export async function deleteSiteMap(environmentSlug: string): Promise<boolean> {
  try {
    const filePath = getSiteMapPath(environmentSlug);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      clearCacheForEnvironment(environmentSlug);
      log.debug('Site map deleted', { module: 'JourneyRepository', environmentSlug });
      return true;
    }

    return false;
  } catch (error) {
    log.error(
      'Failed to delete site map',
      error instanceof Error ? error : new Error(String(error)),
      { module: 'JourneyRepository', environmentSlug }
    );
    return false;
  }
}
