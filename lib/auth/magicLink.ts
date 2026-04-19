import { randomId } from "@/lib/crypto";
import {
  createMagicLinkToken,
  getMagicLinkToken,
  useMagicLinkToken as consumeMagicLinkToken,
} from "@/lib/db/mock";
import { log } from '@/lib/utils/logger';
import { getMagicLinkUrl } from '@/lib/url-helpers';

const MAGIC_LINK_EXPIRY = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a magic link token for email-based login
 */
export async function generateMagicLink(email: string): Promise<string> {
  const token = randomId(48); // 48 character token
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY);
  
  await createMagicLinkToken(token, email, expiresAt);
  
  return token;
}

/**
 * Verify and consume a magic link token
 */
export async function verifyMagicLink(token: string): Promise<string | null> {
  const magicLink = await getMagicLinkToken(token);
  
  if (!magicLink || magicLink.used) {
    return null;
  }
  
  const success = await consumeMagicLinkToken(token);
  if (!success) {
    return null;
  }
  
  return magicLink.email;
}

/**
 * Simulate sending an email by logging the magic link URL
 * In production, this would integrate with an email service
 */
export function sendMagicLinkEmail(email: string, token: string): void {
  const magicLinkUrl = getMagicLinkUrl(token);

  log.info('MAGIC LINK EMAIL (DEV MODE)', {
    module: 'MagicLink',
    to: email,
    link: magicLinkUrl,
    instructions: 'Copy the link and paste it into your browser to log in.'
  });
}