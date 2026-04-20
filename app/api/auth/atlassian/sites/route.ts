import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/auth/iron";
import { getJiraConnection } from "@/lib/server/db/mock";
import type { JiraSite } from "@/types/auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();

    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection || !jiraConnection.connected) {
      return NextResponse.json({ 
        items: [], 
        activeCloudId: null,
        connected: false
      });
    }

    return NextResponse.json({
      items: jiraConnection.sites || [],
      activeCloudId: jiraConnection.activeCloudId || null,
      activeSiteName: jiraConnection.activeSiteName || null,
      connected: true,
    });

  } catch (error) {
    console.error("Get Jira sites error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get Jira sites" },
      { status: 500 }
    );
  }
}