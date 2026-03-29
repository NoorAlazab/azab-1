import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLink } from "@/lib/auth/magicLink";
import { createUser } from "@/lib/db/mock";
import { setUserInSession } from "@/lib/auth/iron";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    
    if (!token) {
      return NextResponse.json(
        { error: "Missing token parameter" },
        { status: 400 }
      );
    }
    
    // Verify and consume magic link token
    const email = await verifyMagicLink(token);
    if (!email) {
      return NextResponse.json(
        { error: "Invalid or expired magic link" },
        { status: 400 }
      );
    }
    
    // Create or get user
    const user = await createUser(email);
    
    // Create session
    await setUserInSession(user);
    
    // Create response with redirect
    const redirectUrl = new URL("/", request.url);
    const response = NextResponse.redirect(redirectUrl);
    
    return response;
  } catch (error) {
    console.error("Magic link callback error:", error);
    
    // Redirect to login with error
    const loginUrl = new URL("/login?error=magic_link_failed", request.url);
    return NextResponse.redirect(loginUrl);
  }
}