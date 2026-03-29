import { NextRequest, NextResponse } from 'next/server';
import { getJiraIssueDB } from '@/lib/jira/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const issueKey = searchParams.get('key') || 'SCRUM-2';
  
  try {
    console.log('🧪 [Test] Testing database auth with issue:', issueKey);
    const issue = await getJiraIssueDB(issueKey);
    
    return NextResponse.json({
      success: true,
      issue: issue,
      message: `Successfully fetched ${issueKey} using database auth with decrypted token!`
    });
    
  } catch (error: any) {
    console.error('❌ [Test] Failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      jiraError: error.jiraError || null
    }, { 
      status: error.jiraError?.status || 500 
    });
  }
}