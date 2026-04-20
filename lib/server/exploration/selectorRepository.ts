/**
 * Selector Repository
 * Loads and resolves UI element selectors from mapping files
 * Provides reliable element location with fallback strategies
 */

import type { Page, Locator } from 'playwright';
import type {
  SelectorMapping,
  ElementSelector,
  ElementFindResult,
  FindElementOptions,
  SelectorRepositoryConfig,
} from '@/types/selectors';
import { log } from '@/lib/shared/utils/logger';
import fs from 'fs';
import path from 'path';

// In-memory cache for selector mappings
const mappingCache = new Map<string, SelectorMapping>();
let cacheEnabled = true;

// Statistics tracking
const stats = {
  totalFinds: 0,
  primaryHits: 0,
  fallbackHits: 0,
  failures: 0,
};

/**
 * Load a selector mapping for a page
 * NEW: Database-first approach - tries database first, then falls back to files
 * @param pageName - The page name (e.g., "login", "dashboard")
 * @param environmentSlug - Optional environment slug for environment-specific selectors
 * @param environmentConfigId - Optional environment config ID for database lookup
 */
export async function loadSelectorMapping(
  pageName: string,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<SelectorMapping | null> {
  const cacheKey = environmentConfigId
    ? `db:${environmentConfigId}:${pageName}`
    : environmentSlug
    ? `${environmentSlug}:${pageName}`
    : pageName;

  // Check cache first
  if (cacheEnabled && mappingCache.has(cacheKey)) {
    log.debug('Selector mapping loaded from cache', {
      module: 'SelectorRepository',
      pageName,
      environmentSlug,
      source: environmentConfigId ? 'database' : 'file'
    });
    return mappingCache.get(cacheKey)!;
  }

  // Strategy 1: Try database first (if environmentConfigId provided)
  if (environmentConfigId) {
    try {
      log.debug('Loading selectors from database', {
        module: 'SelectorRepository',
        pageName,
        environmentConfigId,
      });

      const { loadSelectorsFromDatabase } = await import('@/lib/server/db/selectorService');
      const mapping = await loadSelectorsFromDatabase(environmentConfigId, pageName);

      if (mapping) {
        // Cache it
        if (cacheEnabled) {
          mappingCache.set(cacheKey, mapping);
        }

        log.debug('Selector mapping loaded from database', {
          module: 'SelectorRepository',
          pageName,
          environmentConfigId,
          elementCount: Object.keys(mapping.elements).length,
        });

        return mapping;
      } else {
        log.debug('No selectors found in database, falling back to files', {
          module: 'SelectorRepository',
          pageName,
          environmentConfigId,
        });
      }
    } catch (error) {
      log.warn('Failed to load selectors from database, falling back to files', {
        module: 'SelectorRepository',
        pageName,
        environmentConfigId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Strategy 2: Fall back to file-based loading
  try {
    // Determine file path
    const selectorDir = path.join(process.cwd(), 'selectors');
    let filePath: string;
    const pathsToTry: string[] = [];

    // If environment slug provided, try environment-specific path first
    if (environmentSlug) {
      const envPath = path.join(selectorDir, 'environments', environmentSlug, `${pageName}.json`);
      pathsToTry.push(envPath);
    }

    // Fall back to shared pages
    const pagesPath = path.join(selectorDir, 'pages', `${pageName}.json`);
    const rootPath = path.join(selectorDir, `${pageName}.json`);
    pathsToTry.push(pagesPath, rootPath);

    // Find first existing file
    filePath = '';
    for (const tryPath of pathsToTry) {
      if (fs.existsSync(tryPath)) {
        filePath = tryPath;
        break;
      }
    }

    if (!filePath) {
      log.warn('Selector mapping file not found', {
        module: 'SelectorRepository',
        pageName,
        environmentSlug,
        triedPaths: pathsToTry,
      });
      return null;
    }

    // Read and parse file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const mapping: SelectorMapping = JSON.parse(fileContent);

    // Validate basic structure
    if (!mapping.page || !mapping.elements) {
      throw new Error('Invalid selector mapping: missing required fields (page, elements)');
    }

    // Cache it
    if (cacheEnabled) {
      mappingCache.set(cacheKey, mapping);
    }

    log.debug('Selector mapping loaded', {
      module: 'SelectorRepository',
      pageName,
      environmentSlug,
      filePath,
      elementCount: Object.keys(mapping.elements).length,
    });

    return mapping;
  } catch (error) {
    log.error(
      'Failed to load selector mapping',
      error instanceof Error ? error : new Error(String(error)),
      { module: 'SelectorRepository', pageName, environmentSlug }
    );
    return null;
  }
}

/**
 * Find an element by its key from the selector repository
 * NEW: Supports database-first loading via environmentConfigId
 */
export async function findElementByKey(
  page: Page,
  elementKey: string,
  pageName: string,
  options?: FindElementOptions,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<Locator> {
  stats.totalFinds++;

  const mapping = await loadSelectorMapping(pageName, environmentSlug, environmentConfigId);
  if (!mapping) {
    stats.failures++;
    throw new Error(`No selector mapping found for page: ${pageName}` + (environmentSlug ? ` (environment: ${environmentSlug})` : ''));
  }

  const elementDef = mapping.elements[elementKey];
  if (!elementDef) {
    stats.failures++;
    const availableKeys = Object.keys(mapping.elements).join(', ');
    throw new Error(
      `Element key '${elementKey}' not found in mapping for page '${pageName}'. Available keys: ${availableKeys}`
    );
  }

  log.debug('Finding element by key', {
    module: 'SelectorRepository',
    pageName,
    elementKey,
    elementType: elementDef.metadata.type,
  });

  // Try to find element using selector strategies
  const result = await findElementWithStrategies(page, elementDef, options);

  if (!result.found || !result.usedSelector) {
    stats.failures++;
    throw new Error(
      `Element '${elementKey}' not found on page '${pageName}'. ${result.error || 'No matching elements'}`
    );
  }

  // Track statistics
  if (result.strategy === 'primary') {
    stats.primaryHits++;
  } else {
    stats.fallbackHits++;
  }

  log.debug('Element found', {
    module: 'SelectorRepository',
    elementKey,
    strategy: result.strategy,
    selector: result.usedSelector,
    duration: result.duration,
  });

  // Return the locator
  return page.locator(result.usedSelector).first();
}

/**
 * Find element using multiple selector strategies
 */
async function findElementWithStrategies(
  page: Page,
  elementDef: ElementSelector,
  options?: FindElementOptions
): Promise<ElementFindResult> {
  const startTime = Date.now();
  const timeout = options?.timeout || 10000;
  const mustBeVisible = options?.mustBeVisible ?? true;
  const mustBeEnabled = options?.mustBeEnabled ?? false;

  // Strategy 1: Try primary selector
  try {
    const locator = page.locator(elementDef.primary).first();
    const count = await locator.count();

    if (count > 0) {
      // Check visibility if required
      if (mustBeVisible) {
        const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
        if (!isVisible) {
          log.debug('Primary selector found element but not visible', {
            module: 'SelectorRepository',
            selector: elementDef.primary,
          });
        } else {
          // Check enabled if required
          if (mustBeEnabled) {
            const isEnabled = await locator.isEnabled({ timeout: 1000 }).catch(() => false);
            if (!isEnabled) {
              log.debug('Primary selector found element but not enabled', {
                module: 'SelectorRepository',
                selector: elementDef.primary,
              });
            } else {
              return {
                found: true,
                usedSelector: elementDef.primary,
                strategy: 'primary',
                count,
                duration: Date.now() - startTime,
              };
            }
          } else {
            return {
              found: true,
              usedSelector: elementDef.primary,
              strategy: 'primary',
              count,
              duration: Date.now() - startTime,
            };
          }
        }
      } else {
        return {
          found: true,
          usedSelector: elementDef.primary,
          strategy: 'primary',
          count,
          duration: Date.now() - startTime,
        };
      }
    }
  } catch (error) {
    log.debug('Primary selector failed', {
      module: 'SelectorRepository',
      selector: elementDef.primary,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Strategy 2: Try fallback selectors
  for (let i = 0; i < elementDef.fallbacks.length; i++) {
    const fallbackSelector = elementDef.fallbacks[i];

    try {
      const locator = page.locator(fallbackSelector).first();
      const count = await locator.count();

      if (count > 0) {
        // Check visibility if required
        if (mustBeVisible) {
          const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
          if (!isVisible) {
            continue; // Try next fallback
          }
        }

        // Check enabled if required
        if (mustBeEnabled) {
          const isEnabled = await locator.isEnabled({ timeout: 1000 }).catch(() => false);
          if (!isEnabled) {
            continue; // Try next fallback
          }
        }

        log.debug('Fallback selector successful', {
          module: 'SelectorRepository',
          fallbackIndex: i,
          selector: fallbackSelector,
        });

        return {
          found: true,
          usedSelector: fallbackSelector,
          strategy: `fallback-${i}` as `fallback-${number}`,
          count,
          duration: Date.now() - startTime,
        };
      }
    } catch (error) {
      log.debug('Fallback selector failed', {
        module: 'SelectorRepository',
        fallbackIndex: i,
        selector: fallbackSelector,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // All strategies failed
  return {
    found: false,
    error: `Element not found using primary selector '${elementDef.primary}' or ${elementDef.fallbacks.length} fallback(s)`,
    duration: Date.now() - startTime,
  };
}

/**
 * Get all available selector mapping files
 */
export function getAllMappings(): string[] {
  const selectorDir = path.join(process.cwd(), 'selectors');
  const mappings: string[] = [];

  // Check root directory
  if (fs.existsSync(selectorDir)) {
    const rootFiles = fs.readdirSync(selectorDir);
    rootFiles
      .filter(file => file.endsWith('.json') && file !== 'schema.json')
      .forEach(file => {
        mappings.push(file.replace('.json', ''));
      });
  }

  // Check pages/ subdirectory
  const pagesDir = path.join(selectorDir, 'pages');
  if (fs.existsSync(pagesDir)) {
    const pageFiles = fs.readdirSync(pagesDir);
    pageFiles
      .filter(file => file.endsWith('.json'))
      .forEach(file => {
        mappings.push(file.replace('.json', ''));
      });
  }

  return Array.from(new Set(mappings)); // Remove duplicates
}

/**
 * Get element keys available for a page
 * NEW: Supports database-first loading via environmentConfigId
 */
export async function getElementKeys(
  pageName: string,
  environmentSlug?: string,
  environmentConfigId?: string
): Promise<string[]> {
  const mapping = await loadSelectorMapping(pageName, environmentSlug, environmentConfigId);
  if (!mapping) {
    return [];
  }
  return Object.keys(mapping.elements);
}

/**
 * Clear the mapping cache
 */
export function clearCache(): void {
  mappingCache.clear();
  log.debug('Selector mapping cache cleared', { module: 'SelectorRepository' });
}

/**
 * Get repository statistics
 */
export function getStats() {
  return {
    ...stats,
    primaryHitRate: stats.totalFinds > 0 ? (stats.primaryHits / stats.totalFinds) * 100 : 0,
    fallbackHitRate: stats.totalFinds > 0 ? (stats.fallbackHits / stats.totalFinds) * 100 : 0,
    failureRate: stats.totalFinds > 0 ? (stats.failures / stats.totalFinds) * 100 : 0,
  };
}

/**
 * Configure the selector repository
 */
export function configure(config: SelectorRepositoryConfig): void {
  if (config.enableCache !== undefined) {
    cacheEnabled = config.enableCache;
  }

  log.debug('Selector repository configured', {
    module: 'SelectorRepository',
    config,
  });
}
