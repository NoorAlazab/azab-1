import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { getRun, getBug, updateBugJiraStatus } from "@/lib/exploration/db";
import { publishBugAsComment, publishBugAsTicket } from "@/lib/exploration/jira-publisher";

interface PublishRequest {
  runId: string;
  bugId: string;
  mode: "comment" | "ticket";
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse request body
    const body: PublishRequest = await request.json();
    const { runId, bugId, mode } = body;

    if (!runId || !bugId || !mode) {
      return NextResponse.json(
        { error: "runId, bugId, and mode are required" },
        { status: 400 }
      );
    }

    if (mode !== "comment" && mode !== "ticket") {
      return NextResponse.json(
        { error: "mode must be 'comment' or 'ticket'" },
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

    // Get the bug
    const bug = await getBug(runId, bugId);
    if (!bug) {
      return NextResponse.json(
        { error: "Bug not found" },
        { status: 404 }
      );
    }

    // Get story key from run source
    if (run.source.type !== "story") {
      return NextResponse.json(
        { error: "Can only publish bugs for story-based explorations" },
        { status: 400 }
      );
    }

    const storyKey = run.source.key;

    // Update bug status to publishing
    await updateBugJiraStatus(runId, bugId, "publishing");

    try {
      // Publish based on mode
      let result;

      if (mode === "comment") {
        result = await publishBugAsComment(userId, bug, storyKey);

        if (result.success) {
          await updateBugJiraStatus(runId, bugId, "published_comment");
          return NextResponse.json({
            success: true,
            mode: "comment",
            commentId: result.commentId,
          });
        }
      } else {
        // mode === "ticket"
        result = await publishBugAsTicket(userId, bug, storyKey);

        if (result.success) {
          await updateBugJiraStatus(runId, bugId, "published_bug", result.issueKey);
          return NextResponse.json({
            success: true,
            mode: "ticket",
            issueKey: result.issueKey,
          });
        }
      }

      // If we get here, publishing failed
      await updateBugJiraStatus(runId, bugId, "failed");
      return NextResponse.json(
        { error: result.error || "Failed to publish bug" },
        { status: 500 }
      );
    } catch (publishError) {
      // Mark as failed
      await updateBugJiraStatus(runId, bugId, "failed");
      throw publishError;
    }
  } catch (error) {
    console.error("Publish bug error:", error);
    return NextResponse.json(
      { error: "Failed to publish bug" },
      { status: 500 }
    );
  }
}
