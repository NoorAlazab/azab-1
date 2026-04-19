import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export type ActivityEventType =
  | "generation"
  | "writeback"
  | "connection"
  | "error";

export type ActivityEventStatus = "success" | "pending" | "error";

export interface ActivityEventView {
  id: string;
  type: ActivityEventType;
  title: string;
  description?: string;
  status: ActivityEventStatus;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ActivityListOptions {
  limit?: number;
  offset?: number;
}

const MAX_RETAINED_EVENTS = 50;

function rowToView(row: {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}): ActivityEventView {
  return {
    id: row.id,
    type: row.type as ActivityEventType,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as ActivityEventStatus,
    timestamp: row.createdAt,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : undefined,
  };
}

/**
 * Most-recent-first activity events for a user. Defaults to 10 to match the
 * dashboard's "latest 10" view; pass {limit, offset} for pagination.
 */
export async function getActivity(
  userId: string,
  options?: ActivityListOptions,
): Promise<ActivityEventView[]> {
  const { limit = 10, offset = 0 } = options ?? {};
  const rows = await prisma.activityEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
  });
  return rows.map(rowToView);
}

/**
 * Append an event for a user and prune anything beyond the retention cap.
 * The cap matches the legacy in-memory cap of 50 events to avoid growing
 * the table unbounded for active users.
 */
export async function addActivityEvent(
  userId: string,
  event: Omit<ActivityEventView, "id" | "timestamp">,
): Promise<void> {
  await prisma.activityEvent.create({
    data: {
      userId,
      type: event.type,
      title: event.title,
      description: event.description ?? null,
      status: event.status,
      metadata:
        event.metadata && Object.keys(event.metadata).length > 0
          ? (event.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });

  // Trim oldest rows beyond the retention cap. Using a single delete with a
  // subquery would be ideal, but Prisma + SQLite cannot express that, so we
  // pull just the IDs of rows past the cap and delete them in one round-trip.
  const overflow = await prisma.activityEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: MAX_RETAINED_EVENTS,
    select: { id: true },
  });
  if (overflow.length > 0) {
    await prisma.activityEvent.deleteMany({
      where: { id: { in: overflow.map((r) => r.id) } },
    });
  }
}

/**
 * Seed the demo events used by the empty-dashboard onboarding hint.
 * Called from getDashboardOverview when the user has no events yet.
 */
export async function initializeDemoActivity(userId: string): Promise<void> {
  const demo: Array<Omit<ActivityEventView, "id" | "timestamp">> = [
    {
      type: "connection",
      title: "Connected to Jira",
      description: "Successfully connected to Demo Company Jira",
      status: "success",
    },
    {
      type: "generation",
      title: "Generated test cases for DEMO-123",
      description: "Created 8 test cases for magic link authentication",
      status: "success",
    },
    {
      type: "writeback",
      title: "Synced test cases to Jira",
      description: "Added test cases as comments to DEMO-123",
      status: "success",
    },
  ];
  for (const event of demo) {
    await addActivityEvent(userId, event);
  }
}
