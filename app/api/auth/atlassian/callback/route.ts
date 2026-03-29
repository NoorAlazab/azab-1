import { NextResponse } from "next/server";
import { ENV } from "@/lib/env";
import { readAndConsumePkceCookie } from "@/lib/auth/pkce";
import { createOrUpdateJiraConnection } from "@/lib/db/database";
import { encryptToken } from "@/lib/oauth/atlassian";
import { prisma } from "@/lib/db/prisma";
import { encrypt } from "@/lib/crypto/secrets";
import { requireUserId } from "@/lib/auth/iron";
import { getPKCESession } from "@/lib/db/mock";
import crypto from "crypto";
import { log } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const error = url.searchParams.get("error");
    if (error) return NextResponse.redirect(new URL(`/login?oauth_error=${encodeURIComponent(error)}`, ENV.APP_URL));

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return NextResponse.redirect(new URL(`/login?oauth_error=missing_code_or_state`, ENV.APP_URL));

    let codeVerifier: string;
    try {
      codeVerifier = readAndConsumePkceCookie(state);
    } catch (e: any) {
      log.error("PKCE cookie validation failed", e instanceof Error ? e : new Error(String(e.message)), { module: 'AtlassianCallback' });
      return NextResponse.redirect(new URL(`/login?oauth_error=invalid_state`, ENV.APP_URL));
    }

    log.auth('Token exchange starting', undefined, { module: 'AtlassianCallback' });

    // Debug logging for callback
    if (process.env.DEBUG_OAUTH === "1") {
      log.debug('OAuth debug info', {
        module: 'AtlassianCallback',
        clientId: ENV.ATLASSIAN_CLIENT_ID,
        redirectUri: ENV.ATLASSIAN_REDIRECT_URI,
        codeVerifierLength: codeVerifier.length
      });
    }
    
    // Build base token request body
    const base = {
      grant_type: "authorization_code",
      client_id: ENV.ATLASSIAN_CLIENT_ID,
      code,
      redirect_uri: ENV.ATLASSIAN_REDIRECT_URI,
      code_verifier: codeVerifier
    };

    let tokenRes: Response;
    let tokens: any;

    if (ENV.ATLASSIAN_CLIENT_SECRET) {
      // Try with client secret first
      const withSecret = { ...base, client_secret: ENV.ATLASSIAN_CLIENT_SECRET };
      const res1 = await fetch("https://auth.atlassian.com/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(withSecret)
      });
      
      if (!res1.ok) {
        const txt = await res1.text();
        log.error("Token exchange failed (with secret)", new Error(`Status ${res1.status}: ${txt}`), { module: 'AtlassianCallback' });

        // Fallback: try PKCE-only (no secret) in case secret is wrong / app is public
        log.auth('Falling back to PKCE-only token exchange', undefined, { module: 'AtlassianCallback' });
        const res2 = await fetch("https://auth.atlassian.com/oauth/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(base)
        });

        if (!res2.ok) {
          const txt2 = await res2.text();
          log.error("Token exchange failed (PKCE-only)", new Error(`Status ${res2.status}: ${txt2}`), { module: 'AtlassianCallback' });
          
          // Redirect with the exact error
          try {
            const errorObj = JSON.parse(txt2);
            const err = encodeURIComponent(errorObj.error_description ?? "token_exchange_failed");
            return NextResponse.redirect(new URL(`/login?oauth_error=${err}`, ENV.APP_URL));
          } catch {
            return NextResponse.redirect(new URL(`/login?oauth_error=token_exchange_failed`, ENV.APP_URL));
          }
        }
        
        tokenRes = res2;
      } else {
        tokenRes = res1;
      }
    } else {
      // No secret provided, use PKCE-only
      log.auth('Using PKCE-only token exchange', undefined, { module: 'AtlassianCallback' });
      const res = await fetch("https://auth.atlassian.com/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(base)
      });

      if (!res.ok) {
        const txt = await res.text();
        log.error("Token exchange failed (PKCE-only)", new Error(`Status ${res.status}: ${txt}`), { module: 'AtlassianCallback' });
        
        try {
          const errorObj = JSON.parse(txt);
          const err = encodeURIComponent(errorObj.error_description ?? "token_exchange_failed");
          return NextResponse.redirect(new URL(`/login?oauth_error=${err}`, ENV.APP_URL));
        } catch {
          return NextResponse.redirect(new URL(`/login?oauth_error=token_exchange_failed`, ENV.APP_URL));
        }
      }
      
      tokenRes = res;
    }

    tokens = await tokenRes.json(); // { access_token, refresh_token, expires_in, token_type }
    log.auth('Token exchange successful', undefined, { module: 'AtlassianCallback' });

    // Immediately verify the token with /me endpoint
    const meRes = await fetch("https://api.atlassian.com/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!meRes.ok) {
      const txt = await meRes.text();
      log.error("Token verification failed at /me endpoint", new Error(`Status ${meRes.status}: ${txt}`), { module: 'AtlassianCallback' });
      // 401 here is almost always: missing audience or bad scopes
      return NextResponse.redirect(new URL(`/login?oauth_error=oauth_token_invalid_or_wrong_audience`, ENV.APP_URL));
    }

    const meData = await meRes.json();
    if (process.env.DEBUG_OAUTH === "1") {
      log.debug('User verification successful', { module: 'AtlassianCallback', accountId: meData.account_id, email: meData.email });
    }

    // Get user from session (must be logged in)
    const userId = await requireUserId();

    // Get accessible resources (sites)
    const sitesRes = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });
    if (!sitesRes.ok) {
      const txt = await sitesRes.text();
      log.error("Failed to fetch accessible resources", new Error(`Status ${sitesRes.status}: ${txt}`), { module: 'AtlassianCallback' });
      return NextResponse.redirect(new URL(`/login?oauth_error=oauth_sites_unavailable`, ENV.APP_URL));
    }
    const sites = await sitesRes.json();

    if (process.env.DEBUG_OAUTH === "1") {
      log.debug('Found Jira sites', { module: 'AtlassianCallback', sitesCount: sites.length });
    }

    // If exactly one, set activeCloudId; else leave null and show site-select banner
    const activeCloudId = sites.length === 1 ? sites[0].id : null;
    const activeSiteName = sites.length === 1 ? sites[0].name : null;

    if (activeCloudId) {
      log.auth('Auto-selected site', undefined, { module: 'AtlassianCallback', siteName: activeSiteName });
    } else {
      log.auth('Multiple sites available - user must select', undefined, { module: 'AtlassianCallback', sitesCount: sites.length });
    }

    // Encrypt tokens for database storage
    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Save Jira connection to database (existing approach)
    const jiraConnection = await createOrUpdateJiraConnection(
      userId,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      sites.map((site: any) => ({
        id: site.id,
        name: site.name,
        url: site.url,
        scopes: site.scopes || []
      })),
      expiresAt
    );

    // Also save to new JiraToken table for the new token service
    const activeCloudIdForToken = activeCloudId || (sites && sites.length > 0 ? sites[0].id : "");
    await (prisma as any).jiraToken.upsert({
      where: { userId },
      update: {
        cloudId: activeCloudIdForToken,
        accessToken: encrypt(tokens.access_token), // Encrypt access token
        accessExpiresAt: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
        refreshCipher: encrypt(tokens.refresh_token),
        scope: tokens.scope,
      },
      create: {
        userId,
        cloudId: activeCloudIdForToken,
        accessToken: encrypt(tokens.access_token), // Encrypt access token
        accessExpiresAt: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
        refreshCipher: encrypt(tokens.refresh_token),
        scope: tokens.scope,
      },
    });

    // Get returnTo from PKCE session (if available)
    let returnTo = "/dashboard"; // Default
    try {
      const pkceSession = await getPKCESession(state);
      if (pkceSession?.returnTo) {
        returnTo = pkceSession.returnTo;
      }
    } catch (error) {
      // Ignore errors - PKCE session might already be deleted, use default
      console.log("Could not retrieve PKCE session for returnTo:", error);
    }

    // Redirect to the appropriate page
    return NextResponse.redirect(new URL(returnTo, ENV.APP_URL));

  } catch (error) {
    log.error("OAuth callback error", error instanceof Error ? error : new Error(String(error)), { module: 'AtlassianCallback' });
    return NextResponse.redirect(new URL("/login?oauth_error=callback_error", ENV.APP_URL));
  }
}