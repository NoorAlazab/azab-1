import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/iron';
import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/utils/logger';

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Jira connection status
    const jiraConnection = await prisma.jiraConnection.findFirst({
      where: { userId: session.userId },
      select: {
        activeCloudId: true,
        sites: true,
        updatedAt: true,
      },
    });

    // Extract site name from sites JSON
    let siteName: string | undefined;
    if (jiraConnection?.activeCloudId && jiraConnection.sites) {
      const sites = Array.isArray(jiraConnection.sites) ? jiraConnection.sites : [];
      const activeSite: any = sites.find((site: any) => site.id === jiraConnection.activeCloudId);
      siteName = activeSite?.name as string | undefined;
    }

    // Get Jira token status
    const jiraToken = await prisma.jiraToken.findFirst({
      where: {
        userId: session.userId,
        accessExpiresAt: { gt: new Date() }, // Not expired
      },
      select: {
        cloudId: true,
        accessExpiresAt: true,
        obtainedAt: true,
      },
    });

    const hasToken = !!jiraToken;
    const connected = !!(jiraConnection && hasToken);

    // Determine health status
    let health: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (!connected) {
      health = 'error';
    } else if (jiraToken && jiraToken.accessExpiresAt) {
      // Check if token expires soon (within 7 days)
      const expiresIn = jiraToken.accessExpiresAt.getTime() - Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (expiresIn < sevenDays) {
        health = 'degraded';
      }

      // Check if cloud ID mismatch
      if (jiraConnection.activeCloudId !== jiraToken.cloudId) {
        health = 'degraded';
      }
    }

    const response = {
      jira: {
        connected,
        health,
        siteName,
        activeCloudId: jiraConnection?.activeCloudId,
        lastChecked: jiraConnection?.updatedAt?.toISOString(),
        hasToken,
      },
    };

    log.debug('Integration status fetched', {
      module: 'IntegrationStatus',
      userId: session.userId,
      jiraConnected: connected,
      jiraHealth: health,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error(
      'Failed to fetch integration status',
      error instanceof Error ? error : new Error(String(error)),
      { module: 'IntegrationStatus' }
    );

    return NextResponse.json(
      { error: 'Failed to fetch integration status' },
      { status: 500 }
    );
  }
}
