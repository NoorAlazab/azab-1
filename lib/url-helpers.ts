/**
 * URL Helper Utilities
 * Centralized place for building application URLs
 */

import { getEnv, ENV } from '@/lib/env';

/**
 * Get the base application URL
 * Always returns validated APP_URL from environment
 */
export function getAppUrl(): string {
  return ENV.APP_URL;
}

/**
 * Get the public-facing application URL
 * For use in client-side code and public links
 */
export function getPublicAppUrl(): string {
  return ENV.NEXT_PUBLIC_APP_URL || ENV.APP_URL;
}

/**
 * Build an absolute URL for an API route
 * @param path - API route path (e.g., '/api/auth/login')
 * @returns Absolute URL
 */
export function getApiUrl(path: string): string {
  const baseUrl = getAppUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Build an absolute URL for a page route
 * @param path - Page route path (e.g., '/dashboard')
 * @returns Absolute URL
 */
export function getPageUrl(path: string): string {
  const baseUrl = getPublicAppUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Get Atlassian OAuth callback URL
 * Pre-configured and validated from environment
 */
export function getAtlassianCallbackUrl(): string {
  return ENV.ATLASSIAN_REDIRECT_URI;
}

/**
 * Get Atlassian OAuth start URL
 * Standard endpoint for initiating OAuth flow
 */
export function getAtlassianStartUrl(): string {
  return getApiUrl('/api/auth/atlassian/start');
}

/**
 * Build URL for email verification
 * @param token - Verification token
 * @returns Absolute verification URL
 */
export function getVerificationUrl(token: string): string {
  return getApiUrl(`/api/auth/verify?token=${encodeURIComponent(token)}`);
}

/**
 * Build URL for magic link authentication
 * @param token - Magic link token
 * @returns Absolute magic link URL
 */
export function getMagicLinkUrl(token: string): string {
  return getApiUrl(`/api/auth/magic-link/callback?token=${encodeURIComponent(token)}`);
}

/**
 * Build URL for screenshot or evidence file
 * @param path - Relative path to file (e.g., '/explore/run123/screenshot.png')
 * @returns Absolute URL to file
 */
export function getEvidenceUrl(path: string): string {
  return getPublicAppUrl() + (path.startsWith('/') ? path : `/${path}`);
}

/**
 * Check if a URL is from the same origin as the app
 * @param url - URL to check
 * @returns true if same origin, false otherwise
 */
export function isSameOrigin(url: string): boolean {
  try {
    const appUrl = new URL(getAppUrl());
    const testUrl = new URL(url);
    return appUrl.origin === testUrl.origin;
  } catch {
    return false;
  }
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return ENV.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return ENV.NODE_ENV === 'production';
}
