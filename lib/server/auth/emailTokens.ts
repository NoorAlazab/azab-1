import crypto from 'crypto';
import { prisma } from '@/lib/server/db/prisma';

// Generate a cryptographically secure random token
function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Hash a token using SHA-256
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('base64url');
}

// Create a new verification token for a user
export async function createVerificationToken(userId: string): Promise<{ token: string }> {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  
  // Get token lifetime in hours (default 24)
  const hoursToExpire = parseInt(process.env.VERIFY_TOKEN_HOURS || '24');
  const expiresAt = new Date(Date.now() + hoursToExpire * 60 * 60 * 1000);
  
  // Store the hashed token in database
  await prisma.verificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
  
  return { token: rawToken };
}

// Verify and consume a token
export async function verifyToken(rawToken: string): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  
  // Find the token that's not used and not expired
  const tokenRecord = await prisma.verificationToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    include: {
      user: true,
    },
  });
  
  if (!tokenRecord) {
    return null;
  }
  
  // Mark token as used
  await prisma.verificationToken.update({
    where: {
      id: tokenRecord.id,
    },
    data: {
      usedAt: now,
    },
  });
  
  return { userId: tokenRecord.userId };
}

// Clean up expired tokens (optional utility)
export async function cleanupExpiredTokens(): Promise<number> {
  const now = new Date();
  
  const result = await prisma.verificationToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { usedAt: { not: null } },
      ],
    },
  });
  
  return result.count;
}