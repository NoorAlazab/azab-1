import { NextResponse } from "next/server";
import { ENV } from "@/lib/env";
import { codeChallengeS256, randomUrlSafe, genVerifier, setPkceCookie } from "@/lib/auth/pkce";
import { requireUserId } from "@/lib/auth/iron";

export const runtime = "nodejs";

export async function POST() {
  try {
    try { await requireUserId(); } catch { 
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
    }
    const state = randomUrlSafe(24);
    const codeVerifier = genVerifier();
    const codeChallenge = codeChallengeS256(codeVerifier);

    setPkceCookie(state, codeVerifier);

    // Build authorize URL EXACTLY as specified (audience is REQUIRED)
    const scope = "read:jira-work write:jira-work read:me offline_access";
    const authorizeUrl =
      "https://auth.atlassian.com/authorize" +
      `?audience=api.atlassian.com` +                         // REQUIRED
      `&client_id=${ENV.ATLASSIAN_CLIENT_ID}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&redirect_uri=${encodeURIComponent(ENV.ATLASSIAN_REDIRECT_URI)}` +
      `&state=${state}` +
      `&response_type=code` +
      `&prompt=consent` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`;

    if (process.env.DEBUG_OAUTH === "1") {
      console.info("[OAuth] authorizeUrl", authorizeUrl);
    }
    
    return NextResponse.json({ authorizeUrl });

  } catch (error) {
    console.error("PKCE start error:", error);
    return NextResponse.json(
      { error: "Failed to initialize PKCE flow" },
      { status: 500 }
    );
  }
}