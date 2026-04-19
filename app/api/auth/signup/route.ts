export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createVerificationToken } from "@/lib/auth/emailTokens";
import { sendEmail } from "@/lib/email/mailer";
import { renderVerifyEmail } from "@/lib/email/templates/verifyAccount";
import { getApiUrl } from "@/lib/url-helpers";
import { ARGON2_HASH_OPTIONS } from "@/lib/auth/argon2Params";
import { Limiters, enforceRateLimit } from "@/lib/security/rateLimit";
import argon2 from "argon2";

export async function POST(req: Request) {
  // Rate limit anonymous signups by IP — argon2 hashing is the most
  // CPU-expensive operation in the entire app, so we MUST guard it.
  const blocked = await enforceRateLimit(req, Limiters.auth());
  if (blocked) return blocked;

  try {
    const { email, name, password } = await req.json().catch(() => ({}));
    
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }
    
    const normalizedEmail = email.toLowerCase();
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 });
    }
    
    // Create user (not verified by default)
    const passwordHash = await argon2.hash(password, ARGON2_HASH_OPTIONS);
    const user = await prisma.user.create({ 
      data: { 
        email: normalizedEmail, 
        name, 
        passwordHash,
        isVerified: false
      } 
    });
    
    // Create verification token
    const { token } = await createVerificationToken(user.id);

    // Build verification URL
    const verifyUrl = getApiUrl(`/api/auth/verify?token=${token}&email=${encodeURIComponent(normalizedEmail)}`);
    
    // Send verification email
    const emailTemplate = renderVerifyEmail({
      verifyUrl,
      appName: 'OmniForge',
      userEmail: normalizedEmail,
    });
    
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });
      
      // Return success without setting session
      return NextResponse.json({ 
        ok: true, 
        next: `/login?verify=sent&email=${encodeURIComponent(normalizedEmail)}` 
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Check if SMTP is configured
      const smtpConfigured = process.env.SMTP_USER && 
                            process.env.SMTP_PASS && 
                            process.env.SMTP_USER !== 'YOUR_SMTP_USER' &&
                            process.env.SMTP_PASS !== 'YOUR_SMTP_PASS';
      
      if (!smtpConfigured) {
        // Development mode: Allow user to continue but warn about email
        return NextResponse.json({ 
          ok: true, 
          warning: 'SMTP_NOT_CONFIGURED',
          message: 'Account created successfully. Email verification is disabled in development mode.',
          next: `/login?verify=dev&email=${encodeURIComponent(normalizedEmail)}` 
        });
      } else {
        // Production mode: Email sending failed with configured SMTP
        return NextResponse.json({ 
          ok: false, 
          error: "EMAIL_SEND_FAILED",
          message: "Account created but verification email could not be sent. Please contact support."
        }, { status: 500 });
      }
    }
    
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}