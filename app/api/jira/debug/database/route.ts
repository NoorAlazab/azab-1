import { NextRequest, NextResponse } from 'next/server';
import { getJiraSessionFromDB } from '@/lib/jira/auth';
import { prisma } from '@/lib/db/prisma';
import { requireUserId } from '@/lib/auth/iron';
import { denyIfProduction } from '@/lib/security/debugGate';

export async function GET(request: NextRequest) {
  const blocked = denyIfProduction();
  if (blocked) return blocked;

  try {
    console.log('🔍 [Debug] Checking database stored values...');
    
    const userId = await requireUserId();

    // Get raw database values
    const rawToken = await prisma.jiraToken.findUnique({
      where: { userId }
    });

    const rawConnection = await prisma.jiraConnection.findFirst({
      where: { userId }
    });

    // Get what our auth function returns
    const authSession = await getJiraSessionFromDB();
    
    return NextResponse.json({
      success: true,
      rawToken: rawToken ? {
        id: rawToken.id,
        userId: rawToken.userId,
        cloudId: rawToken.cloudId,
        hasAccessToken: !!rawToken.accessToken,
        accessExpiresAt: rawToken.accessExpiresAt,
        scope: rawToken.scope,
        obtainedAt: rawToken.obtainedAt,
        updatedAt: rawToken.updatedAt
      } : null,
      rawConnection: rawConnection ? {
        id: rawConnection.id,
        userId: rawConnection.userId,
        activeCloudId: rawConnection.activeCloudId,
        sites: rawConnection.sites,
        expiresAt: rawConnection.expiresAt,
        createdAt: rawConnection.createdAt,
        updatedAt: rawConnection.updatedAt
      } : null,
      authSessionResult: authSession ? {
        activeCloudId: authSession.activeCloudId,
        activeSiteName: authSession.activeSiteName,
        hasAccessToken: !!authSession.accessToken
      } : null
    });
    
  } catch (error: any) {
    console.error('❌ [Debug] Database check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}