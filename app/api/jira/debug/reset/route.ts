import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/iron';
import { getApiUrl } from '@/lib/url-helpers';
import { denyIfProduction } from '@/lib/security/debugGate';

export async function GET(_request: NextRequest) {
  const blocked = denyIfProduction();
  if (blocked) return blocked;

  try {
    let userId: string;
    try {
      userId = await requireUserId();
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      userId,
      message: 'Ready to re-authenticate. Open the reconnectUrl to start a fresh OAuth flow.',
      reconnectUrl: getApiUrl('/api/auth/atlassian/pkce/start'),
    });
  } catch (error: any) {
    console.error('[Debug] Reset failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
