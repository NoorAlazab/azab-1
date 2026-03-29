import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { getLastUsedEnvUrl, setLastUsedEnvUrl } from "@/lib/exploration/db";
import { z } from "zod";

const SetEnvUrlSchema = z.object({
  envUrl: z.string()
    .max(2048, "Environment URL must be less than 2048 characters")
    .refine((url) => /^https?:\/\//.test(url), {
      message: "Environment URL must start with http:// or https://"
    }),
});

export async function GET(request: NextRequest) {
  try {
    // Require authentication only (no CSRF needed for GET)
    const userId = await requireUserId();

    // Get last used environment URL
    const envUrl = await getLastUsedEnvUrl(userId);

    return NextResponse.json({ envUrl });
  } catch (error) {
    console.error("Get last used env URL error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get last used environment URL" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Require authentication and CSRF token
    const userId = await requireUserId();

    // Parse and validate request body
    const body = await request.json();
    const parseResult = SetEnvUrlSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { envUrl } = parseResult.data;

    // Save the environment URL
    await setLastUsedEnvUrl(userId, envUrl);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Set last used env URL error:", error);
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to save environment URL" },
      { status: 500 }
    );
  }
}