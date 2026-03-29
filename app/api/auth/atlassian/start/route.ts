import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { generateAuthUrl } from "@/lib/oauth/atlassian";
import { AtlassianStartResponse } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get returnTo parameter from query params or request body
    const url = new URL(request.url);
    const returnToFromQuery = url.searchParams.get('returnTo');
    const body = await request.json().catch(() => ({}));
    const returnTo = body.returnTo || returnToFromQuery || '/dashboard';

    // Generate OAuth authorization URL with returnTo
    const { authorizeUrl } = await generateAuthUrl(returnTo);

    console.log("Generated Atlassian OAuth URL:", authorizeUrl);
    console.log("Will return to:", returnTo);

    const response: AtlassianStartResponse = {
      authorizeUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Atlassian OAuth start error:", error);
    return NextResponse.json(
      { error: "Failed to start OAuth flow" },
      { status: 500 }
    );
  }
}
