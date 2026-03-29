import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { getJiraConnection } from "@/lib/db/database";
import { StartExplorationBodySchema } from "@/lib/exploration/validators";
import { createExplorationRun } from "@/lib/exploration/service";
import { getFile, setLastUsedEnvUrl } from "@/lib/exploration/db";
import type { StartExplorationResponse } from "@/lib/exploration/types";

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = StartExplorationBodySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { source, config } = parseResult.data;

    // Additional validation based on source type
    if (source.type === "story") {
      // Check if Jira is connected
      const jiraConnection = await getJiraConnection(userId);
      if (!jiraConnection) {
        return NextResponse.json(
          { error: "Jira connection required for story-based exploration" },
          { status: 400 }
        );
      }

      // In a real implementation, we might validate the story key exists
      // For now, we trust the client-side validation
    }

    if (source.type === "pdf") {
      // Verify the file exists
      const file = await getFile(userId, source.fileId);
      if (!file) {
        return NextResponse.json(
          { error: "Referenced file not found" },
          { status: 400 }
        );
      }

      // Update source with file details from our records
      source.filename = file.filename;
      source.size = file.size;
    }

    // Save the last used environment URL
    await setLastUsedEnvUrl(userId, config.envUrl);
    
    // Create the exploration run
    const run = await createExplorationRun(userId, source, config);

    const response: StartExplorationResponse = {
      runId: run.id,
      status: run.status,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Start exploration error:", error);
    return NextResponse.json(
      { error: "Failed to start exploration" },
      { status: 500 }
    );
  }
}