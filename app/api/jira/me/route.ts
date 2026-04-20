import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/auth/iron";
import { getJiraConnection } from "@/lib/server/db/mock";
import { 
  makeAtlassianApiRequest, 
  decryptToken, 
  refreshAccessToken, 
  encryptToken 
} from "@/lib/server/oauth/atlassian";
import { saveJiraConnection } from "@/lib/server/db/mock";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    
    // Get Jira connection
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection) {
      return NextResponse.json(
        { error: "Jira not connected" },
        { status: 404 }
      );
    }
    
    if (!jiraConnection.accessTokenEncrypted) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 401 }
      );
    }
    
    let accessToken = decryptToken(jiraConnection.accessTokenEncrypted);
    
    // Check if token needs refresh
    if (jiraConnection.expiresAt && jiraConnection.expiresAt <= new Date()) {
      try {
        if (!jiraConnection.refreshTokenEncrypted) {
          return NextResponse.json(
            { error: "No refresh token available" },
            { status: 401 }
          );
        }
        const refreshToken = decryptToken(jiraConnection.refreshTokenEncrypted);
        const newTokens = await refreshAccessToken(refreshToken);
        
        // Update stored tokens
        const updatedConnection = {
          ...jiraConnection,
          accessTokenEncrypted: encryptToken(newTokens.access_token),
          refreshTokenEncrypted: encryptToken(newTokens.refresh_token),
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
          updatedAt: new Date(),
        };
        
        await saveJiraConnection(updatedConnection);
        accessToken = newTokens.access_token;
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        return NextResponse.json(
          { error: "Token refresh failed. Please reconnect Jira." },
          { status: 401 }
        );
      }
    }
    
    // Make request to Atlassian /me endpoint
    const response = await makeAtlassianApiRequest(accessToken, "/me");
    
    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Authentication failed. Please reconnect Jira." },
          { status: 401 }
        );
      }
      
      throw new Error(`Atlassian API error: ${response.status} ${response.statusText}`);
    }
    
    const meData = await response.json();
    
    // Find the active site information
    const activeSite = jiraConnection.sites?.find(site => site.id === jiraConnection.activeCloudId);
    
    // Return user profile and site info
    return NextResponse.json({
      profile: meData,
      site: activeSite ? {
        id: activeSite.id,
        name: activeSite.name,
        url: activeSite.url,
        scopes: activeSite.scopes,
      } : null,
    });
    
  } catch (error) {
    console.error("Jira me endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Jira profile" },
      { status: 500 }
    );
  }
}