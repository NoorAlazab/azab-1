import { generateCodeVerifier, generateCodeChallenge, randomId } from "@/lib/server/crypto";
import { getEnv } from "@/lib/shared/env";
import { AtlassianTokenResponse, AtlassianResource, AtlassianMe } from "@/types/api";
import { PKCESession } from "@/types/auth";
import { savePKCESession, getPKCESession, deletePKCESession } from "@/lib/server/db/mock";
import { setPkceCookie } from "@/lib/server/auth/pkce";

const ATLASSIAN_OAUTH_BASE_URL = "https://auth.atlassian.com";
const ATLASSIAN_API_BASE_URL = "https://api.atlassian.com";

const REQUIRED_SCOPES = [
  "read:jira-work",
  "write:jira-work", 
  "read:me",
  "offline_access"
];

export class AtlassianOAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public hint?: string
  ) {
    super(message);
    this.name = "AtlassianOAuthError";
  }
}

/**
 * Generate authorization URL with PKCE
 */
export async function generateAuthUrl(returnTo?: string): Promise<{ authorizeUrl: string; nonce: string }> {
  const env = getEnv();
  const nonce = randomId(32);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store PKCE session
  const pkceSession: PKCESession = {
    nonce,
    codeVerifier,
    state: nonce, // Using nonce as state for simplicity
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    returnTo, // Store returnTo path for post-OAuth redirect
  };

  await savePKCESession(nonce, pkceSession);

  // Also set PKCE cookie for callback validation
  setPkceCookie(nonce, codeVerifier);

  console.log("ENV", env);
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: env.ATLASSIAN_CLIENT_ID,
    scope: REQUIRED_SCOPES.join(" "),
    redirect_uri: env.ATLASSIAN_REDIRECT_URI,
    state: nonce,
    response_type: "code",
    prompt: "consent",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  
  const authorizeUrl = `${ATLASSIAN_OAUTH_BASE_URL}/authorize?${params.toString()}`;
  
  return { authorizeUrl, nonce };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  state: string
): Promise<AtlassianTokenResponse> {
  const env = getEnv();
  
  // Retrieve and validate PKCE session
  const pkceSession = await getPKCESession(state);
  if (!pkceSession) {
    throw new AtlassianOAuthError(
      "Invalid or expired OAuth state",
      "INVALID_STATE",
      400
    );
  }
  
  // Clean up PKCE session immediately
  await deletePKCESession(state);
  
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.ATLASSIAN_CLIENT_ID,
    client_secret: env.ATLASSIAN_CLIENT_SECRET,
    code,
    redirect_uri: env.ATLASSIAN_REDIRECT_URI,
    code_verifier: pkceSession.codeVerifier,
  });
  
  const response = await fetch(`${ATLASSIAN_OAUTH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: tokenParams,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new AtlassianOAuthError(
      `Token exchange failed: ${errorData.error || response.statusText}`,
      "TOKEN_EXCHANGE_FAILED",
      response.status,
      errorData.error_description
    );
  }
  
  const tokenData: AtlassianTokenResponse = await response.json();
  return tokenData;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<AtlassianTokenResponse> {
  const env = getEnv();
  
  const refreshParams = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.ATLASSIAN_CLIENT_ID,
    client_secret: env.ATLASSIAN_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  
  const response = await fetch(`${ATLASSIAN_OAUTH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: refreshParams,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new AtlassianOAuthError(
      `Token refresh failed: ${errorData.error || response.statusText}`,
      "TOKEN_REFRESH_FAILED",
      response.status,
      errorData.error_description
    );
  }
  
  const tokenData: AtlassianTokenResponse = await response.json();
  return tokenData;
}

/**
 * Revoke tokens
 */
export async function revokeTokens(accessToken: string): Promise<void> {
  // Atlassian doesn't have a standard revoke endpoint, but we can try to call an endpoint
  // to invalidate the token or just rely on token expiration
  try {
    await fetch(`${ATLASSIAN_API_BASE_URL}/me`, {
      method: "DELETE", // This might not work, but it's worth a try
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
  } catch {
    // Ignore errors - token revocation is best effort
  }
}

/**
 * Get accessible cloud sites
 */
export async function getAccessibleResources(accessToken: string): Promise<AtlassianResource[]> {
  const response = await fetch(`${ATLASSIAN_OAUTH_BASE_URL}/oauth/token/accessible-resources`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new AtlassianOAuthError(
      `Failed to fetch accessible resources: ${response.statusText}`,
      "RESOURCES_FETCH_FAILED",
      response.status
    );
  }
  
  const resources: AtlassianResource[] = await response.json();
  return resources;
}

/**
 * Get user profile information
 */
export async function getMe(accessToken: string): Promise<AtlassianMe> {
  const response = await fetch(`${ATLASSIAN_API_BASE_URL}/me`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new AtlassianOAuthError(
      `Failed to fetch user profile: ${response.statusText}`,
      "PROFILE_FETCH_FAILED",
      response.status
    );
  }
  
  const profile: AtlassianMe = await response.json();
  return profile;
}

/**
 * Make authenticated request to Atlassian API
 */
export async function makeAtlassianApiRequest(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `${ATLASSIAN_API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  return response;
}

/**
 * Encrypt token for storage (simple base64 encoding for demo)
 * In production, use proper encryption with a secret key
 */
export function encryptToken(token: string): string {
  return Buffer.from(token).toString("base64");
}

/**
 * Decrypt token from storage
 */
export function decryptToken(encryptedToken: string): string {
  return Buffer.from(encryptedToken, "base64").toString("utf-8");
}