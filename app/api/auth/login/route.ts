export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db/prisma";
import { setUserInSession } from "@/lib/server/auth/iron";
import { getDummyHashForTimingMitigation } from "@/lib/server/auth/argon2Params";
import argon2 from "argon2";
import { Limiters, enforceRateLimit } from "@/lib/server/security/rateLimit";

export async function POST(req: Request) {
  // Per-IP rate limit BEFORE any DB or argon2 work so we cannot be
  // ground down by a credential-stuffing flood. Identified by IP
  // because the caller is by definition not yet authenticated.
  const blocked = await enforceRateLimit(req, Limiters.auth());
  if (blocked) return blocked;

  try {
    const { email, password } = await req.json().catch(() => ({}));

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Timing mitigation: when no user is found we still run argon2.verify
    // against a fixed dummy hash so the response time does not reveal
    // whether the email is registered. The result is discarded.
    if (!user) {
      const dummy = await getDummyHashForTimingMitigation();
      await argon2.verify(dummy, password).catch(() => false);
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    
    // Check if email is verified
    if (!user.isVerified) {
      // Check if SMTP is configured
      const smtpConfigured = process.env.SMTP_USER && 
                            process.env.SMTP_PASS && 
                            process.env.SMTP_USER !== 'YOUR_SMTP_USER' &&
                            process.env.SMTP_PASS !== 'YOUR_SMTP_PASS';
      
      if (!smtpConfigured && process.env.NODE_ENV === 'development') {
        // Development mode with no SMTP: Allow login but warn
        console.warn('Development mode: Allowing unverified user login due to SMTP not configured');
      } else {
        // Production or SMTP configured: Enforce verification
        return NextResponse.json({ 
          ok: false, 
          error: "EMAIL_NOT_VERIFIED", 
          message: "Please verify your email to continue." 
        }, { status: 403 });
      }
    }
    
    // Set session and return success
    await setUserInSession(user);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}