import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { RunStatusQuerySchema } from "@/lib/exploration/validators";
import { getRunStatus } from "@/lib/exploration/service";
import type { RunStatusResponse } from "@/lib/exploration/types";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const parseResult = RunStatusQuerySchema.safeParse({
      runId: searchParams.get("runId"),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { runId } = parseResult.data;

    // Get the run status
    const run = await getRunStatus(userId, runId);

    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      );
    }

    const response: RunStatusResponse = run;
    return NextResponse.json(response);
  } catch (error) {
    console.error("Get run status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch run status" },
      { status: 500 }
    );
  }
}