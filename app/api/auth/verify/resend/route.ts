export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db/prisma";
import { createVerificationToken } from "@/lib/server/auth/emailTokens";
import { sendEmail } from "@/lib/server/email/mailer";
import { renderVerifyEmail } from "@/lib/server/email/templates/verifyAccount";
import { getApiUrl } from "@/lib/url-helpers";
import { Limiters, enforceRateLimit } from "@/lib/server/security/rateLimit";

export async function POST(req: Request) {
  // Per-IP cap so the resend endpoint cannot be used to spam an
  // inbox even when the per-user 60s throttle is fresh.
  const blocked = await enforceRateLimit(req, Limiters.auth());
  if (blocked) return blocked;

  try {
    const { email } = await req.json().catch(() => ({}));
    
    if (!email) {
      return NextResponse.json({ ok: false, error: "MISSING_EMAIL" }, { status: 400 });
    }
    
    const normalizedEmail = email.toLowerCase();
    
    // Find user
    const user = await prisma.user.findUnique({ 
      where: { email: normalizedEmail } 
    });
    
    // Always return success to prevent email enumeration
    // (Don't reveal whether the account exists or not)
    if (!user || user.isVerified) {
      return NextResponse.json({ ok: true });
    }
    
    // Check for recent tokens to prevent spam (optional throttling)
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gt: new Date(Date.now() - 60 * 1000), // Within last 60 seconds
        },
      },
    });
    
    if (recentToken) {
      return NextResponse.json({ 
        ok: false, 
        error: "TOO_MANY_REQUESTS",
        message: "Please wait before requesting another verification email." 
      }, { status: 429 });
    }
    
    // Create new verification token
    const { token } = await createVerificationToken(user.id);

    // Build verification URL
    const verifyUrl = getApiUrl(`/api/auth/verify?token=${token}&email=${encodeURIComponent(normalizedEmail)}`);
    
    // Send verification email
    const emailTemplate = renderVerifyEmail({
      verifyUrl,
      appName: 'OmniForge',
      userEmail: normalizedEmail,
    });
    
    await sendEmail({
      to: normalizedEmail,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}