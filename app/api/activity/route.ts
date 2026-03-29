import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/iron";
import { getActivity } from "@/lib/db/mock";

const activityQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const parseResult = activityQuerySchema.safeParse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { limit, offset } = parseResult.data;

    // Get activity events
    const activity = await getActivity(userId, { limit, offset });

    return NextResponse.json(activity);
  } catch (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}