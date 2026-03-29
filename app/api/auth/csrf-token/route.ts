import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { issueCsrfToken } from "@/lib/security/csrf";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    await requireUserId();

    // Issue a new CSRF token
    const csrfToken = issueCsrfToken();

    return NextResponse.json({ 
      csrfToken 
    });
  } catch (error) {
    console.error("Get CSRF token error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get CSRF token" },
      { status: 500 }
    );
  }
}