"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConnectionCard } from "@/components/dashboard/ConnectionCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { QuickAddTests } from "@/components/dashboard/QuickAddTests";
import { RecentStories } from "@/components/dashboard/RecentStories";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { IntegrationStatusChip } from "@/components/layout/IntegrationStatusChip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, AlertCircle } from "lucide-react";
import type { DashboardOverview } from "@/lib/server/dashboard/getDashboardOverview";

/**
 * Dashboard interactive shell.
 *
 * Receives `initialData` from the RSC parent and seeds React Query with
 * it so the first render has no loading state. The 30-second refetch
 * interval keeps the data fresh client-side without re-running the RSC.
 *
 * Navigation uses Next's `useRouter().push()` (soft navigation) instead
 * of `window.location.href = ...` (full page reload). Soft nav reuses
 * the cached layout chunks and runtime state, which is dramatically
 * faster on a feature-heavy dashboard.
 */

interface DashboardClientProps {
  initialData: DashboardOverview;
}

const fetchDashboardData = async (): Promise<DashboardOverview> => {
  const response = await fetch("/api/dashboard/overview", {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error("Failed to fetch dashboard data");
  return response.json();
};

const updateChecklistItem = async ({
  item,
  value,
}: {
  item: string;
  value: boolean;
}) => {
  const response = await fetch("/api/checklist", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item, value }),
  });
  if (!response.ok) throw new Error("Failed to update checklist item");
  return response.json();
};

export function DashboardClient({ initialData }: DashboardClientProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  const { data, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
    initialData,
    refetchInterval: 30000,
  });

  // Mutation kept around for parity with the original component (not yet
  // wired to a UI control). Removing it would be a separate cleanup.
  useMutation({
    mutationFn: updateChecklistItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // Soft navigation helper. router.push is async-ish in App Router, so
  // wrap in a transition to avoid blocking the click handler.
  const navigate = (path: string) => {
    startTransition(() => {
      router.push(path);
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleChecklistAction = (key: string) => {
    switch (key) {
      case "connectJira":
        navigate("/settings?tab=integrations");
        break;
      case "configureLLM":
        navigate("/settings#llm");
        break;
      case "chooseStorageMode":
        navigate("/settings#storage");
        break;
      case "firstSuite":
        navigate("/suites/create");
        break;
      case "explore":
        navigate("/suites");
        break;
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "createSuite":
        navigate("/suites/create");
        break;
      case "searchStories":
        navigate("/stories");
        break;
      case "generateTests":
        navigate("/generator");
        break;
      case "exportSuite":
        navigate("/suites?action=export");
        break;
      case "importSuite":
        navigate("/suites?action=import");
        break;
      case "settings":
        navigate("/settings");
        break;
    }
  };

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    // Should never happen because initialData is provided, but kept as a
    // safety net for type narrowing.
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="text-center">
          <p className="text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  const completedChecklist = Object.values(data.checklist).every(Boolean);

  // Map the API's flexible activity event shape into the strict union the
  // ActivityFeed component expects. Unknown event types fall back to
  // 'suite_updated' so the UI never crashes on a future backend addition.
  const mappedActivity = data.recentActivity.map((event) => ({
    id: event.id,
    type: mapActivityType(event.type),
    description: event.description ?? event.title,
    timestamp: event.timestamp,
  }));

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {data.user.name}
            </p>
          </div>
          <IntegrationStatusChip />
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-6">
          <ConnectionCard
            connection={data.jiraConnection}
            onConnect={() => handleChecklistAction("connectJira")}
            onManage={() => navigate("/settings#jira")}
          />

          <QuickActions
            onCreateSuite={() => handleQuickAction("createSuite")}
            onSearchStories={() => handleQuickAction("searchStories")}
            onGenerateTests={() => handleQuickAction("generateTests")}
            onExportSuite={() => handleQuickAction("exportSuite")}
            onImportSuite={() => handleQuickAction("importSuite")}
            onSettings={() => handleQuickAction("settings")}
          />

          <QuickAddTests />
        </div>

        <div className="space-y-6">
          {!completedChecklist && (
            <GettingStarted
              checklist={data.checklist}
              onItemAction={handleChecklistAction}
            />
          )}

          <RecentStories
            stories={data.recentStories}
            onViewAll={() => navigate("/stories")}
            onGenerateTests={(story) => navigate(`/generator?issueKey=${story.key}`)}
          />
        </div>

        <div className="space-y-6">
          <ActivityFeed events={mappedActivity} showLimit={8} />

          {completedChecklist && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Quick Stats</CardTitle>
                <CardDescription>Your QA CaseForge summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-brand">
                      {data.recentStories.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Recent Stories</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-brand">
                      {data.recentActivity.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Activities</div>
                  </div>
                </div>
                {data.jiraConnection.isConnected && (
                  <div className="text-center pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Connected to</div>
                    <div className="font-medium text-sm">
                      {data.jiraConnection.siteName}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

type ActivityFeedEventType =
  | "suite_created"
  | "test_generated"
  | "suite_exported"
  | "suite_imported"
  | "settings_updated"
  | "jira_connected"
  | "suite_updated";

const KNOWN_TYPES = new Set<ActivityFeedEventType>([
  "suite_created",
  "test_generated",
  "suite_exported",
  "suite_imported",
  "settings_updated",
  "jira_connected",
  "suite_updated",
]);

function mapActivityType(type: string): ActivityFeedEventType {
  return KNOWN_TYPES.has(type as ActivityFeedEventType)
    ? (type as ActivityFeedEventType)
    : "suite_updated";
}
