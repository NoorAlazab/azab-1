import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/auth/iron";
import { getJiraConnection, updateActiveJiraSite } from "@/lib/server/db/mock";
import { assertValidCsrf } from "@/lib/server/security/csrf";
import { z } from "zod";

const SetActiveSiteSchema = z.object({
  cloudId: z.string().min(1, "Cloud ID is required"),
});

export async function PATCH(request: NextRequest) {
  try {
    assertValidCsrf();
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token" }), { status: e.status ?? 403, headers: { "content-type": "application/json" } });
  }

  try {
    const userId = await requireUserId();

    const body = await request.json();
    const validation = SetActiveSiteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid request body",
          details: validation.error.format(),
        },
        { status: 422 }
      );
    }

    const { cloudId } = validation.data;

    // Get current Jira connection
    const jiraConnection = await getJiraConnection(userId);
    if (!jiraConnection || !jiraConnection.connected || !jiraConnection.sites) {
      return NextResponse.json(
        { error: "Jira connection not found" },
        { status: 400 }
      );
    }

    // Validate that cloudId exists in user's sites
    const site = jiraConnection.sites.find(s => s.id === cloudId);
    if (!site) {
      return NextResponse.json(
        { error: "Cloud ID not found in accessible sites" },
        { status: 404 }
      );
    }

    // Update active site
    const success = await updateActiveJiraSite(userId, cloudId);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to update active site" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      activeCloudId: cloudId,
      activeSiteName: site.name,
    });

  } catch (error) {
    console.error("Set active Jira site error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to set active site" },
      { status: 500 }
    );
  }
}