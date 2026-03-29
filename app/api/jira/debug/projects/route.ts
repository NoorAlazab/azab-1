import { NextRequest, NextResponse } from "next/server";
import { makeJiraApiCallDB } from "@/lib/jira/auth";

export async function GET(request: NextRequest) {
  // Disable debug endpoints in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    console.log('🔍 [DEBUG] Fetching available projects...');
    
    // Try different project endpoints to see which works
    let projects;
    try {
      console.log('🔍 [DEBUG] Trying project/search...');
      projects = await makeJiraApiCallDB('project/search');
    } catch (error: any) {
      console.log('❌ [DEBUG] project/search failed, trying project...');
      try {
        projects = await makeJiraApiCallDB('project');
        // If this returns an array, wrap it in values property for consistency
        if (Array.isArray(projects)) {
          projects = { values: projects };
        }
      } catch (error2: any) {
        console.log('❌ [DEBUG] project failed too, trying project/recent...');
        projects = await makeJiraApiCallDB('project/recent');
        if (Array.isArray(projects)) {
          projects = { values: projects };
        }
      }
    }
    
    console.log('✅ [DEBUG] Found projects:', projects.values?.length || 0);
    
    return NextResponse.json({
      success: true,
      projects: projects.values?.map((project: any) => ({
        key: project.key,
        name: project.name,
        projectTypeKey: project.projectTypeKey,
        id: project.id
      })) || []
    });
    
  } catch (error: any) {
    console.error('❌ [DEBUG] Projects fetch error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch projects',
        projects: []
      },
      { status: 500 }
    );
  }
}