import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/iron";

export async function POST(request: NextRequest) {
  try {
    // Get current session
    const session = await getSession();
    
    if (!session.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // With iron-session, we just need to save the session to refresh it
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh session" },
      { status: 500 }
    );
  }
}