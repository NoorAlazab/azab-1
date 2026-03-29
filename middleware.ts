import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/generator/:path*",
    "/exploration/:path*",
    "/api/auth/atlassian/:path*",
    "/api/jira/:path*",
    "/api/generator/:path*",
  ],
};

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get("qacf_session")?.value;
  if (!cookie) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}