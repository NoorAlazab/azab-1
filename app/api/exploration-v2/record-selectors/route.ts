import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/iron';
import { recordSelectorsWithJourneys, createPageMetadata } from '@/lib/exploration/selectorRecorder';
import { saveEnvironmentConfig, normalizeEnvironmentUrl, updatePagesMetadata } from '@/lib/exploration/environmentManager';
import type { RecordSelectorsRequest, RecordSelectorsResponse } from '@/types/environment';
import { log } from '@/lib/utils/logger';
import { normalizePageKeyword } from '@/lib/utils/pageKeywordNormalizer';

export const maxDuration = 300; // 5 minutes max for recording

/**
 * POST /api/exploration-v2/record-selectors
 * Records element selectors from specified pages in an environment
 */
export async function POST(request: NextRequest) {
  try {
    log.debug('Record selectors request received', { module: 'RecordSelectorsAPI' });

    // Require authentication
    const userId = await requireUserId();

    // Parse request
    const body: RecordSelectorsRequest = await request.json();
    const { environment, username, password, pages, storyKey, saveCredentials = true } = body;

    // Validate required fields
    if (!environment || !pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'Environment and pages are required' },
        { status: 400 }
      );
    }

    const environmentSlug = normalizeEnvironmentUrl(environment);

    log.debug('Recording selectors', {
      module: 'RecordSelectorsAPI',
      environment,
      environmentSlug,
      pages,
      hasCredentials: !!(username && password),
      saveCredentials,
    });

    // Check if Playwright is available
    let hasPlaywright = false;
    try {
      await import('playwright');
      hasPlaywright = true;
    } catch (error) {
      log.warn('Playwright not available', { module: 'RecordSelectorsAPI' });
      return NextResponse.json(
        {
          success: false,
          error: 'Playwright is not installed. Run: npm install playwright && npx playwright install',
        },
        { status: 500 }
      );
    }

    // Launch browser and record (visible browser for user to see)
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: false,  // Show browser window to user
      slowMo: 300,      // Slow down actions for visibility (300ms delay)
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let journeys: any[] = [];

      // ALWAYS use journey-based recording (clicking UI, not URL assumptions)
      // This ensures pages are discovered through actual navigation, not hardcoded URLs
      log.debug('Using journey-based selector recording (UI click navigation)', {
        module: 'RecordSelectorsAPI',
        environmentSlug,
        pagesProvided: pages,
        hasCredentials: !!(username && password),
      });

      // Use provided page keywords
      // If no pages specified, discoverPages will scan ALL navigation items
      const pageKeywords = pages.length > 0 ? pages : [];

      if (pageKeywords.length === 0) {
        log.debug('No page keywords provided, will discover all visible navigation', {
          module: 'RecordSelectorsAPI',
          storyKey: storyKey || 'none',
        });
      }

      log.debug('Using page keywords for UI-based discovery', {
        module: 'RecordSelectorsAPI',
        pageKeywords: pageKeywords.length > 0 ? pageKeywords : 'ALL_NAVIGATION',
      });

      // NEW: Check for cached selectors before recording
      const { getEnvironmentConfig: getEnvConfigEarly } = await import('@/lib/exploration/environmentManager');
      const { checkExistingSelectors } = await import('@/lib/db/selectorService');

      const earlyEnvConfig = await getEnvConfigEarly(userId, environment);
      const cachedResults: any[] = [];
      let pagesToRecord: string[] = [];

      if (earlyEnvConfig && pageKeywords.length > 0) {
        log.debug('Checking for cached selectors before recording', {
          module: 'RecordSelectorsAPI',
          pageCount: pageKeywords.length,
        });

        for (const pageKeyword of pageKeywords) {
          const existing = await checkExistingSelectors(earlyEnvConfig.id, pageKeyword);

          if (existing && existing.selectors.length > 0) {
            log.debug('Found cached selectors for page, skipping recording', {
              module: 'RecordSelectorsAPI',
              page: pageKeyword,
              selectorCount: existing.selectors.length,
            });

            cachedResults.push({
              page: pageKeyword,
              success: true,
              elementsRecorded: existing.selectors.length,
              cached: true,
            });
          } else {
            log.debug('No cached selectors, will record page', {
              module: 'RecordSelectorsAPI',
              page: pageKeyword,
            });
            pagesToRecord.push(pageKeyword);
          }
        }
      } else {
        // No environment config yet or no specific pages, record all
        pagesToRecord = pageKeywords;
      }

      // Only record pages that don't have cached selectors
      const keywordsToRecord = pagesToRecord.length > 0 ? pagesToRecord : pageKeywords;

      log.debug('Recording new selectors', {
        module: 'RecordSelectorsAPI',
        cachedPages: cachedResults.length,
        pagesToRecord: keywordsToRecord.length,
      });

      const journeyResult = await recordSelectorsWithJourneys(
        page,
        environment,
        keywordsToRecord,
        username && password ? { username, password } : undefined,
        storyKey
      );

      const results = [...cachedResults, ...journeyResult.results];
      journeys = journeyResult.journeys;

      log.debug('Journey-based recording complete', {
        module: 'RecordSelectorsAPI',
        journeysCount: journeys.length,
        resultsCount: results.length,
      });

      // Save environment config if credentials provided and saveCredentials is true
      if (saveCredentials && username && password) {
        await saveEnvironmentConfig(
          userId,
          environment,
          { username, password }
        );
      }

      // Update pages metadata
      const metadata = createPageMetadata(results, storyKey);
      if (Object.keys(metadata).length > 0) {
        await updatePagesMetadata(userId, environment, metadata);
      }

      // Save selectors to database (NEW: database-first storage)
      const { getEnvironmentConfig } = await import('@/lib/exploration/environmentManager');
      const { saveSelectorsToDatabase, saveJourneyToDatabase, saveNavigationSelector } = await import('@/lib/db/selectorService');
      const { loadSelectorMapping } = await import('@/lib/exploration/selectorRepository');

      // Get or create environment config
      const envConfig = await getEnvironmentConfig(userId, environment);

      if (envConfig) {
        log.debug('Saving selectors to database', {
          module: 'RecordSelectorsAPI',
          environmentConfigId: envConfig.id,
          resultsCount: results.length,
        });

        // Save each recorded page's selectors to database
        for (const result of results) {
          if (result.success && result.page) {
            try {
              // Load selector mapping from file (which was just saved by the recorder)
              const mapping = await loadSelectorMapping(result.page, environmentSlug);

              if (mapping && mapping.elements) {
                await saveSelectorsToDatabase(
                  envConfig.id,
                  result.page,
                  environment,
                  mapping.elements,
                  storyKey
                );

                log.debug('Saved selectors for page to database', {
                  module: 'RecordSelectorsAPI',
                  page: result.page,
                  elementCount: Object.keys(mapping.elements).length,
                });
              }
            } catch (error) {
              log.error('Failed to save selectors for page to database', error instanceof Error ? error : new Error(String(error)), {
                module: 'RecordSelectorsAPI',
                page: result.page,
              });
            }
          }
        }

        // Save journeys to database
        if (journeys && journeys.length > 0) {
          for (const journey of journeys) {
            try {
              await saveJourneyToDatabase(
                envConfig.id,
                journey.from || 'start',
                journey.pageKeyword,  // FIX: Use pageKeyword, not 'to'
                journey.steps || []
              );

              log.debug('Saved journey to database', {
                module: 'RecordSelectorsAPI',
                from: journey.from || 'start',
                to: journey.pageKeyword,
              });

              // NEW: Save navigation selector if available (for smart navigation)
              const navData = (journey as any).navigationSelector;

              log.debug('Checking for navigation selector data', {
                module: 'RecordSelectorsAPI',
                journeyKeyword: journey.pageKeyword,
                hasNavData: !!navData,
                stepsCount: journey.steps?.length || 0,
              });

              if (navData) {
                try {
                  log.debug('Saving navigation selector', {
                    module: 'RecordSelectorsAPI',
                    sourcePageName: navData.sourcePageName,
                    navElementKey: navData.navElementKey,
                    leadsToPage: navData.leadsToPage,
                    discoveredUrl: navData.discoveredUrl,
                    selectorType: typeof navData.navSelector,
                  });

                  console.log('NAV DATA:', navData);
                  // FIX: navSelector is an ElementSelector object, extract primary selector
                  const selectorString = navData.navSelector;
                  console.log('NAV SELECTOR STRING:', selectorString);
                  // Normalize page keywords for consistent database storage
                  const normalizedSource = normalizePageKeyword(navData.sourcePageName || 'dashboard');
                  const normalizedDestination = normalizePageKeyword(navData.leadsToPage);

                  await saveNavigationSelector(
                    envConfig.id,
                    normalizedSource,
                    navData.navElementKey,
                    selectorString,
                    normalizedDestination,
                    navData.discoveredUrl,
                    storyKey
                  );

                  log.debug('✅ Navigation selector saved to database', {
                    module: 'RecordSelectorsAPI',
                    sourcePageName: navData.sourcePageName,
                    leadsToPage: navData.leadsToPage,
                    discoveredUrl: navData.discoveredUrl,
                  });
                } catch (saveNavError) {
                  log.error('Failed to save navigation selector', saveNavError instanceof Error ? saveNavError : new Error(String(saveNavError)), {
                    module: 'RecordSelectorsAPI',
                    navData,
                  });
                }
              } else {
                log.warn('No navigationSelector field on journey', {
                  module: 'RecordSelectorsAPI',
                  journeyKeyword: journey.pageKeyword,
                  journeyFields: Object.keys(journey),
                });
              }
            } catch (error) {
              log.error('Failed to save journey to database', error instanceof Error ? error : new Error(String(error)), {
                module: 'RecordSelectorsAPI',
                journey,
              });
            }
          }
        }
      }

      // Calculate totals
      const recordedPages = results.filter(r => r.success);
      const totalElements = recordedPages.reduce((sum, r) => sum + r.elementsRecorded, 0);

      const response: RecordSelectorsResponse = {
        success: true,
        environmentSlug,
        recordedPages: results,
        skippedPages: [],
        totalElements,
        journeys: journeys.length > 0 ? journeys : undefined,
      };

      log.debug('Selector recording completed', {
        module: 'RecordSelectorsAPI',
        environmentSlug,
        recordedPagesCount: recordedPages.length,
        totalElements,
        journeyMode: true,  // Always uses journey-based recording
      });

      return NextResponse.json(response);

    } finally {
      await browser.close();
    }

  } catch (error) {
    log.error('Record selectors failed', error instanceof Error ? error : new Error(String(error)), {
      module: 'RecordSelectorsAPI',
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record selectors',
      },
      { status: 500 }
    );
  }
}
