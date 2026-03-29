import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { listRuns } from "@/lib/exploration/db";
import { initializeDemoExplorationData } from "@/lib/exploration/db";
import type { RunsResponse } from "@/lib/exploration/types";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Initialize demo data if in development mode and no runs exist
    if (process.env.NODE_ENV === 'development') {
      await initializeDemoExplorationData(userId);
    }

    // Get all runs for the user
    const runs = await listRuns(userId);

    const response: RunsResponse = {
      runs,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("List runs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch runs" },
      { status: 500 }
    );
  }
}