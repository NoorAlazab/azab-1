import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/auth/iron";
import { getJiraConnection, deleteJiraConnection } from "@/lib/server/db/mock";
import { revokeTokens, decryptToken } from "@/lib/server/oauth/atlassian";
import { DisconnectResponse } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    // Require authentication and CSRF token
    const userId = await requireUserId();
    
    // Get existing Jira connection
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection) {
      return NextResponse.json(
        { error: "No Jira connection found" },
        { status: 404 }
      );
    }
    
    try {
      // Attempt to revoke tokens (best effort)
      if (jiraConnection.accessTokenEncrypted) {
        const accessToken = decryptToken(jiraConnection.accessTokenEncrypted);
        await revokeTokens(accessToken);
      }
    } catch (revokeError) {
      // Log but don't fail the disconnect operation
      console.warn("Token revocation failed:", revokeError);
    }
    
    // Remove connection from database
    await deleteJiraConnection(userId);
    
    const response: DisconnectResponse = {
      ok: true,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Atlassian disconnect error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to disconnect Jira" },
      { status: 500 }
    );
  }
}