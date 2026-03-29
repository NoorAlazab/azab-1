import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/iron';
import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/utils/logger';

export async function POST() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete Jira tokens
    const deletedTokens = await prisma.jiraToken.deleteMany({
      where: { userId: session.userId },
    });

    // Delete Jira connection
    const deletedConnection = await prisma.jiraConnection.deleteMany({
      where: { userId: session.userId },
    });

    log.auth('jira_disconnected', session.userId, {
      module: 'IntegrationDisconnect',
      tokensDeleted: deletedTokens.count,
      connectionsDeleted: deletedConnection.count,
    });

    return NextResponse.json({
      success: true,
      message: 'Jira disconnected successfully',
      tokensDeleted: deletedTokens.count,
      connectionsDeleted: deletedConnection.count,
    });
  } catch (error) {
    log.error(
      'Failed to disconnect Jira',
      error instanceof Error ? error : new Error(String(error)),
      { module: 'IntegrationDisconnect' }
    );

    return NextResponse.json(
      {
        error: 'Failed to disconnect Jira',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
