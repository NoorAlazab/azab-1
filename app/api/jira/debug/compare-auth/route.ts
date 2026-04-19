import { NextRequest, NextResponse } from 'next/server';
import { getJiraSessionFromDB } from '@/lib/jira/auth';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { ENV } from '@/lib/env';
import { denyIfProduction } from '@/lib/security/debugGate';

// Try to get session the OLD way (cookie-based)
async function getOldJiraSession() {
  try {
    const session = await getIronSession<any>(cookies(), {
      password: ENV.SESSION_SECRET,
      cookieName: "qa-caseforge-session",
    });
    
    return {
      hasSession: !!session,
      userId: session.userId,
      jiraData: session.jira || null,
      allSessionData: session
    };
  } catch (error: any) {
    return {
      error: error.message,
      hasSession: false
    };
  }
}

export async function GET(request: NextRequest) {
  const blocked = denyIfProduction();
  if (blocked) return blocked;

  try {
    console.log('🔍 [Compare] Testing old vs new auth systems...');
    
    // Test new DB-based system
    const newAuth = await getJiraSessionFromDB();
    
    // Test old cookie-based system  
    const oldAuth = await getOldJiraSession();
    
    return NextResponse.json({
      success: true,
      comparison: {
        newAuth: newAuth ? {
          hasAuth: true,
          cloudId: newAuth.activeCloudId,
          siteName: newAuth.activeSiteName,
          hasToken: !!newAuth.accessToken
        } : { hasAuth: false },
        oldAuth: oldAuth,
        analysis: {
          newAuthWorking: !!newAuth,
          oldAuthWorking: !!oldAuth.hasSession,
          cloudIdMatch: newAuth?.activeCloudId === oldAuth.jiraData?.cloudId,
          recommendation: newAuth && oldAuth.hasSession ? 
            'Both systems working - check token permissions' :
            !newAuth && oldAuth.hasSession ?
            'New system broken - use old system' :
            'Need to re-authenticate'
        }
      }
    });
    
  } catch (error: any) {
    console.error('❌ [Compare] Comparison failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}