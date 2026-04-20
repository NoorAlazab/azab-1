import { NextResponse } from 'next/server';
import { getJiraSessionFromDB } from '@/lib/server/jira/auth';
import { log } from '@/lib/utils/logger';
import { getSession } from '@/lib/server/auth/iron';

export async function POST() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Jira authentication
    const auth = await getJiraSessionFromDB();

    if (!auth || !auth.accessToken || !auth.activeCloudId) {
      return NextResponse.json(
        { error: 'Jira not connected. Please connect your Jira account first.' },
        { status: 400 }
      );
    }

    const cloudId = auth.activeCloudId;

    // Test connection by fetching current user
    const userResponse = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      log.error(
        'Jira connection test failed',
        new Error(`HTTP ${userResponse.status}: ${errorText}`),
        {
          module: 'IntegrationTest',
          userId: session.userId,
          status: userResponse.status,
        }
      );

      return NextResponse.json(
        {
          error: `Connection test failed: ${userResponse.statusText}`,
          details: errorText,
        },
        { status: 502 }
      );
    }

    const user = await userResponse.json();

    // Test by fetching site information
    const sitesResponse = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    let siteName = auth.activeSiteName || 'Unknown';
    if (sitesResponse.ok) {
      const sites = await sitesResponse.json();
      const currentSite = sites.find((site: any) => site.id === cloudId);
      if (currentSite) {
        siteName = currentSite.name;
      }
    }

    log.debug('Jira connection test successful', {
      module: 'IntegrationTest',
      userId: session.userId,
      cloudId,
      siteName,
      userDisplayName: user.displayName,
    });

    return NextResponse.json({
      success: true,
      cloudId,
      siteName,
      user: {
        accountId: user.accountId,
        displayName: user.displayName,
        emailAddress: user.emailAddress,
      },
    });
  } catch (error) {
    log.error(
      'Jira connection test error',
      error instanceof Error ? error : new Error(String(error)),
      { module: 'IntegrationTest' }
    );

    return NextResponse.json(
      {
        error: 'Connection test failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
