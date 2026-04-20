export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db/prisma";
import { verifyToken } from "@/lib/server/auth/emailTokens";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');
    
    if (!token) {
      // Redirect to login with invalid token error
      return NextResponse.redirect(new URL('/login?verify=invalid', req.url));
    }
    
    // Verify the token
    const result = await verifyToken(token);
    
    if (!result) {
      // Token is invalid or expired
      return NextResponse.redirect(new URL('/login?verify=invalid', req.url));
    }
    
    // Mark user as verified
    await prisma.user.update({
      where: { id: result.userId },
      data: { isVerified: true },
    });
    
    // Redirect to login with success message
    const redirectUrl = email 
      ? `/login?verified=1&email=${encodeURIComponent(email)}`
      : '/login?verified=1';
      
    return NextResponse.redirect(new URL(redirectUrl, req.url));
    
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(new URL('/login?verify=invalid', req.url));
  }
}