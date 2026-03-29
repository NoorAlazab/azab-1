import { NextRequest, NextResponse } from "next/server";
import { ENV } from "@/lib/env";

export async function GET(request: NextRequest) {
  try {
    // Validate required environment variables
    const reasons: string[] = [];
    
    if (!ENV.ATLASSIAN_CLIENT_ID) {
      reasons.push("Missing: ATLASSIAN_CLIENT_ID");
    }
    
    if (!ENV.ATLASSIAN_REDIRECT_URI) {
      reasons.push("Missing: ATLASSIAN_REDIRECT_URI");
    }
    
    // Client ID is validated by Zod to be the correct value

    if (reasons.length > 0) {
      return NextResponse.json({
        ok: false,
        reasons
      });
    }

    // Configuration is valid
    const clientId = ENV.ATLASSIAN_CLIENT_ID;
    const redirectUri = ENV.ATLASSIAN_REDIRECT_URI;
    const scope = "read:jira-work write:jira-work read:me offline_access";
    const audience = "api.atlassian.com";
    return NextResponse.json({
      ok: true,
      clientId,
      redirectUri,
      scope,
      audience,
      message: "OAuth configuration is valid"
    });

  } catch (error) {
    console.error("Preflight check error:", error);
    return NextResponse.json({
      ok: false,
      reasons: ["Environment validation error"]
    }, { status: 500 });
  }
}