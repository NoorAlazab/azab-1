export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { issueCsrfToken } from "@/lib/server/security/csrf";

export async function GET() {
  const token = issueCsrfToken();
  return NextResponse.json({ csrfToken: token });
}