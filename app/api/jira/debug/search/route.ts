import { NextRequest, NextResponse } from 'next/server';
import { makeJiraApiCallDB } from '@/lib/jira/auth';

export async function GET(request: NextRequest) {
  // Disable debug endpoints in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    console.log('🔍 [Debug] Searching for recent issues...');
    
    // Try multiple approaches to find issues
    let searchResult;
    
    try {
      // First try the new search endpoint
      console.log('🔍 [Debug] Trying new search endpoint...');
      searchResult = await makeJiraApiCallDB('search/jql?jql=order by created desc&maxResults=10');
    } catch (error: any) {
      console.log('❌ [Debug] New search failed, trying POST method...');
      
      try {
        // Try POST method with JQL in body
        searchResult = await makeJiraApiCallDB('search', {
          method: 'POST',
          body: JSON.stringify({
            jql: 'order by created desc',
            maxResults: 10
          })
        });
      } catch (postError: any) {
        console.log('❌ [Debug] POST search failed, trying project search...');
        
        // If search fails, try to get all projects first
        const projectsResult = await makeJiraApiCallDB('project');
        return NextResponse.json({
          success: true,
          searchFailed: true,
          projects: projectsResult,
          message: 'Search failed, but here are available projects'
        });
      }
    }
    
    console.log('✅ [Debug] Search successful:', JSON.stringify(searchResult, null, 2));
    
    return NextResponse.json({
      success: true,
      totalIssues: searchResult.total,
      issues: searchResult.issues?.map((issue: any) => ({
        key: issue.key,
        summary: issue.fields?.summary || 'No summary',
        project: issue.fields?.project?.key || 'Unknown project',
        status: issue.fields?.status?.name || 'Unknown status'
      })) || []
    });
  } catch (error: any) {
    console.error('❌ [Debug] Search failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      jiraError: error.jiraError || null
    }, { 
      status: error.jiraError?.status || 500 
    });
  }
}