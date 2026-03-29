import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { listBugsForRun, getRun } from "@/lib/exploration/db";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get runId from query params
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json(
        { error: "runId query parameter is required" },
        { status: 400 }
      );
    }

    // Verify the run belongs to the user
    const run = await getRun(userId, runId);
    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      );
    }

    // Get bugs for this run
    const bugs = await listBugsForRun(runId);

    return NextResponse.json({ bugs });
  } catch (error) {
    console.error("List bugs error:", error);
    return NextResponse.json(
      { error: "Failed to list bugs" },
      { status: 500 }
    );
  }
}
