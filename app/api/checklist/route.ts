import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/server/auth/iron";
import { updateChecklistItem } from "@/lib/server/db/mock";

const updateChecklistSchema = z.object({
  item: z.enum(["connectJira", "configureLLM", "chooseStorageMode", "firstSuite"]),
  value: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const parseResult = updateChecklistSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { item, value } = parseResult.data;

    // Update checklist item
    await updateChecklistItem(userId, item, value);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Checklist update error:", error);
    return NextResponse.json(
      { error: "Failed to update checklist" },
      { status: 500 }
    );
  }
}