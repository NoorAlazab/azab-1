// Cache for CSRF token to avoid multiple API calls
let csrfTokenCache: string | null = null;

/**
 * Get CSRF token from API for client-side requests
 */
export async function getClientCsrfToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  // Return cached token if available
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  try {
    const response = await fetch('/api/auth/csrf-token', {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Failed to fetch CSRF token:', response.status);
      return null;
    }

    const data = await response.json();
    csrfTokenCache = data.csrfToken;
    return csrfTokenCache;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    return null;
  }
}

/**
 * Make a fetch request with automatic CSRF token inclusion
 */
export async function fetchWithCsrf(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  
  // Add CSRF token to headers if this is a mutation request
  if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE' || options.method === 'PATCH') {
    const csrfToken = await getClientCsrfToken();
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  });
}