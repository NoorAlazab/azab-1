import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/iron";
import {
  getDashboardOverview,
  DashboardUserNotFoundError,
} from "@/lib/dashboard/getDashboardOverview";
import { DashboardClient } from "./DashboardClient";

/**
 * Dashboard page (Server Component).
 *
 * Fetches the overview payload server-side and hands it to the client
 * component as `initialData`. Benefits:
 *
 *   - First paint is fully populated; no spinner, no client-only fetch
 *     waterfall after the JS bundle loads.
 *   - The auth check happens before we ship a single byte to the client,
 *     so unauthenticated users get a clean redirect instead of a flash
 *     of empty layout.
 *   - The browser still gets the React Query cache hydrated, so the
 *     existing 30-second refetch interval keeps working as before.
 */

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    // Mirrors middleware behavior: send the user to /login with a return
    // path so the post-login redirect lands them back here.
    redirect("/login?next=/dashboard");
  }

  let initialData;
  try {
    initialData = await getDashboardOverview(userId);
  } catch (error) {
    if (error instanceof DashboardUserNotFoundError) {
      redirect("/login?next=/dashboard");
    }
    throw error;
  }

  return <DashboardClient initialData={initialData} />;
}
