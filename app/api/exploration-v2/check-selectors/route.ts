import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/iron';
import { checkPagesRecorded, getEnvironmentConfig } from '@/lib/exploration/environmentManager';
import type { CheckSelectorsResult } from '@/types/environment';
import { log } from '@/lib/utils/logger';

/**
 * GET /api/exploration-v2/check-selectors
 * Checks which pages have selectors recorded for an environment
 * Query params: environment, pages (comma-separated)
 */
export async function GET(request: NextRequest) {
  try {
    log.debug('Check selectors request received', { module: 'CheckSelectorsAPI' });

    // Require authentication
    const userId = await requireUserId();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment');
    const pagesParam = searchParams.get('pages');

    if (!environment) {
      return NextResponse.json(
        { error: 'Environment parameter is required' },
        { status: 400 }
      );
    }

    // Parse pages parameter - handle both JSON array and comma-separated string
    let pages: string[] = [];
    if (pagesParam) {
      try {
        // Try parsing as JSON first (e.g., ["login","dashboard"])
        pages = JSON.parse(pagesParam);
        if (!Array.isArray(pages)) {
          // If it parsed but isn't an array, wrap it
          pages = [String(pages)];
        }
      } catch {
        // If JSON parse fails, treat as comma-separated string
        pages = pagesParam.split(',').map(p => p.trim());
      }
    }

    log.debug('Checking selectors', {
      module: 'CheckSelectorsAPI',
      environment,
      pages,
      pagesCount: pages.length,
    });

    // Check if environment config exists
    const config = await getEnvironmentConfig(userId, environment);
    const environmentExists = !!config;

    if (!environmentExists || pages.length === 0) {
      const result: CheckSelectorsResult = {
        hasSelectors: [],
        needsRecording: pages,
        environmentExists,
      };
      return NextResponse.json(result);
    }

    // Check which pages have selectors
    const { hasSelectors, needsRecording } = await checkPagesRecorded(
      userId,
      environment,
      pages
    );

    const result: CheckSelectorsResult = {
      hasSelectors,
      needsRecording,
      environmentExists,
    };

    log.debug('Check selectors result', {
      module: 'CheckSelectorsAPI',
      hasSelectors: hasSelectors.length,
      needsRecording: needsRecording.length,
    });

    return NextResponse.json(result);

  } catch (error) {
    log.error('Check selectors failed', error instanceof Error ? error : new Error(String(error)), {
      module: 'CheckSelectorsAPI',
    });
    return NextResponse.json(
      { error: 'Failed to check selectors' },
      { status: 500 }
    );
  }
}
