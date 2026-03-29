import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getApiUrl } from '@/lib/url-helpers';

export async function GET(request: NextRequest) {
  // Disable debug endpoints in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    // Clear the existing Jira connection
    const session = await getCurrentSession(request);
    
    if (!session?.userId) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Force a fresh OAuth flow by redirecting to PKCE start
    return NextResponse.json({
      success: true,
      message: 'Ready to re-authenticate. Click the link below to get fresh Jira connection.',
      reconnectUrl: getApiUrl('/api/auth/atlassian/pkce/start')
    });
    
  } catch (error: any) {
    console.error('❌ [Debug] Reset failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}