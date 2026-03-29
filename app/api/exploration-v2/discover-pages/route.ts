import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/iron';
import { normalizeEnvironmentUrl } from '@/lib/exploration/environmentManager';
import { discoverPages } from '@/lib/exploration/pageDiscovery';
import { recordSelectorsWithJourneys } from '@/lib/exploration/selectorRecorder';
import type { DiscoverPagesRequest, DiscoveryResult } from '@/types/journey';
import { log } from '@/lib/utils/logger';

export const maxDuration = 300; // 5 minutes max for discovery

/**
 * POST /api/exploration-v2/discover-pages
 * Discovers pages in an environment using intelligent navigation following
 */
export async function POST(request: NextRequest) {
  try {
    log.debug('Discover pages request received', { module: 'DiscoverPagesAPI' });

    // Require authentication
    const userId = await requireUserId();

    // Parse request
    const body: DiscoverPagesRequest = await request.json();
    const { environmentUrl, credentials, targetKeywords, maxPages = 10 } = body;

    // Validate required fields
    if (!environmentUrl) {
      return NextResponse.json(
        { error: 'Environment URL is required' },
        { status: 400 }
      );
    }

    if (!credentials || !credentials.username || !credentials.password) {
      return NextResponse.json(
        { error: 'Login credentials are required for page discovery' },
        { status: 400 }
      );
    }

    const environmentSlug = normalizeEnvironmentUrl(environmentUrl);

    log.debug('Starting page discovery', {
      module: 'DiscoverPagesAPI',
      environmentUrl,
      environmentSlug,
      targetKeywords,
      maxPages,
    });

    // Check if Playwright is available
    let hasPlaywright = false;
    try {
      await import('playwright');
      hasPlaywright = true;
    } catch (error) {
      log.warn('Playwright not available', { module: 'DiscoverPagesAPI' });
      return NextResponse.json(
        {
          ok: false,
          error: 'Playwright is not installed. Run: npm install playwright && npx playwright install chromium',
        },
        { status: 500 }
      );
    }

    // Launch browser and discover pages
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      // Use recordSelectorsWithJourneys to discover and record in one step
      const { results, journeys } = await recordSelectorsWithJourneys(
        page,
        environmentUrl,
        targetKeywords || [],
        credentials
      );

      // Find keywords that weren't matched
      const discoveredKeywords = new Set(journeys.map(j => j.pageKeyword.toLowerCase()));
      const notFound = (targetKeywords || []).filter(
        kw => !discoveredKeywords.has(kw.toLowerCase())
      );

      // Load the site map that was created by recordSelectorsWithJourneys
      const { loadSiteMap } = await import('@/lib/exploration/journeyRepository');
      const siteMap = await loadSiteMap(environmentSlug);

      const response: DiscoveryResult = {
        pages: journeys,
        notFound,
        siteMap: siteMap || {
          environmentUrl,
          environmentSlug,
          pages: journeys,
          lastUpdated: new Date().toISOString(),
          version: '1.0',
        },
      };

      log.debug('Page discovery completed', {
        module: 'DiscoverPagesAPI',
        discoveredCount: journeys.length,
        notFoundCount: notFound.length,
      });

      return NextResponse.json(response);

    } catch (error) {
      log.error('Page discovery failed', error instanceof Error ? error : new Error(String(error)), {
        module: 'DiscoverPagesAPI',
        environmentUrl,
      });

      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to discover pages',
        },
        { status: 500 }
      );
    } finally {
      await browser.close();
    }

  } catch (error) {
    log.error('Discover pages request failed', error instanceof Error ? error : new Error(String(error)), {
      module: 'DiscoverPagesAPI',
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to process request',
      },
      { status: 500 }
    );
  }
}
