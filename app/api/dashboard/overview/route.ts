import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/auth/iron";
import {
  getDashboardOverview,
  DashboardUserNotFoundError,
} from "@/lib/server/dashboard/getDashboardOverview";

/**
 * GET /api/dashboard/overview
 *
 * Thin HTTP wrapper around `getDashboardOverview`. The same function is
 * called directly by the RSC dashboard page; keeping this route lets the
 * client-side `useQuery` refresh interval continue to work without forcing
 * a full RSC re-fetch every 30 seconds.
 *
 * Response shape is intentionally NOT migrated to the new apiOk envelope
 * yet: the dashboard reads the top-level fields directly (`data.user`,
 * `data.checklist`, etc.) and that contract is shared with the RSC
 * initialData prop. Switching to `{ ok: true, data: {...} }` here would
 * require a coordinated client/server change.
 */

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const overview = await getDashboardOverview(userId);
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof DashboardUserNotFoundError) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    // eslint-disable-next-line no-console
    console.error("Dashboard overview error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 },
    );
  }
}
