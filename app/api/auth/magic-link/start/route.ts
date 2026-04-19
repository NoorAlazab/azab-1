import { NextRequest, NextResponse } from "next/server";
import { emailSchema } from "@/types/api";
import { generateMagicLink, sendMagicLinkEmail } from "@/lib/auth/magicLink";
import { MagicLinkStartResponse } from "@/types/api";
import { Limiters, enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(request: NextRequest) {
  // Magic-link emails are externally observable side effects (an
  // attacker can use this to spam an inbox). Per-IP cap is essential.
  const blocked = await enforceRateLimit(request, Limiters.auth());
  if (blocked) return blocked;

  try {
    const body = await request.json();
    
    // Validate request body
    const parseResult = emailSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }
    
    const { email } = parseResult.data;
    
    // Generate magic link token
    const token = await generateMagicLink(email);
    
    // Send magic link email (in dev mode, just log to console)
    sendMagicLinkEmail(email, token);
    
    const response: MagicLinkStartResponse = {
      ok: true,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Magic link start error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}