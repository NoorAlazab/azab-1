export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { clearSession } from "@/lib/server/auth/iron";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}