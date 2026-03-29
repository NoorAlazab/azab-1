import { NextRequest, NextResponse } from 'next/server';
import { getJiraSessionFromDB } from '@/lib/jira/auth';

export async function GET(request: NextRequest) {
  // Disable debug endpoints in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    console.log('🔍 [Debug] Getting Jira session info...');
    const session = await getJiraSessionFromDB();
    
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'No Jira session found'
      });
    }
    
    console.log('✅ [Debug] Session found:', {
      cloudId: session.activeCloudId,
      siteName: session.activeSiteName,
      hasToken: !!session.accessToken
    });
    
    // Test basic site accessibility
    const siteUrl = `https://api.atlassian.com/ex/jira/${session.activeCloudId}`;
    console.log(`🌐 [Debug] Testing site accessibility: ${siteUrl}`);
    
    const response = await fetch(siteUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`📊 [Debug] Site response: ${response.status} ${response.statusText}`);
    const responseText = await response.text().catch(() => 'Could not read response');
    console.log(`📄 [Debug] Response body:`, responseText);
    
    return NextResponse.json({
      success: true,
      session: {
        cloudId: session.activeCloudId,
        siteName: session.activeSiteName,
        hasToken: !!session.accessToken
      },
      siteTest: {
        status: response.status,
        statusText: response.statusText,
        body: responseText.substring(0, 500) // First 500 chars
      }
    });
    
  } catch (error: any) {
    console.error('❌ [Debug] Failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}