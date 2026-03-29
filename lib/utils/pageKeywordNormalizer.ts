/**
 * Page Keyword Normalization
 * Ensures consistent page keywords for navigation lookups
 */

/**
 * Normalize a page keyword for consistent database storage and lookup
 *
 * Examples:
 * - "Log In" → "login"
 * - "Sign Up" → "signup"
 * - "User Management" → "usermanagement"
 * - "/login" → "login"
 */
export function normalizePageKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .trim()
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[^a-z0-9-]/g, '') // Remove special characters except hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extract and normalize page keyword from URL path
 *
 * Examples:
 * - "https://example.com/login" → "login"
 * - "https://example.com/user-management" → "usermanagement"
 * - "https://example.com/" → "dashboard"
 */
export function extractPageKeywordFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Remove leading/trailing slashes
    const cleanPath = path.replace(/^\/+|\/+$/g, '');

    // If empty, it's the root/home page
    if (!cleanPath) {
      return 'dashboard';
    }

    // Extract first segment
    const firstSegment = cleanPath.split('/')[0];

    // Normalize it
    return normalizePageKeyword(firstSegment);
  } catch (error) {
    return 'dashboard';
  }
}
