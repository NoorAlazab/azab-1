"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConnectionCard } from "@/components/dashboard/ConnectionCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { QuickAddTests } from "@/components/dashboard/QuickAddTests";
import { RecentStories } from "@/components/dashboard/RecentStories";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { IntegrationStatusChip } from "@/components/layout/IntegrationStatusChip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";

interface DashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  jiraConnection: {
    isConnected: boolean;
    siteName?: string;
    cloudId?: string;
    scopes?: string[];
    expiresAt?: string;
  };
  checklist: {
    connectJira: boolean;
    configureLLM: boolean;
    chooseStorageMode: boolean;
    firstSuite: boolean;
  };
  recentStories: Array<{
    id: string;
    key: string;
    summary: string;
    status: string;
    assignee?: string;
    priority?: string;
    storyPoints?: number;
    labels?: string[];
    updated: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'suite_created' | 'test_generated' | 'suite_exported' | 'suite_imported' | 'settings_updated' | 'jira_connected' | 'suite_updated';
    description: string;
    timestamp: string;
    user?: {
      id: string;
      name: string;
      avatar?: string;
    };
    metadata?: Record<string, any>;
  }>;
}

const fetchDashboardData = async (): Promise<DashboardData> => {
  const response = await fetch("/api/dashboard/overview", {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  return response.json();
};

const updateChecklistItem = async ({ item, value }: { item: string; value: boolean }) => {
  const response = await fetch("/api/checklist", {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ item, value }),
  });

  if (!response.ok) {
    throw new Error("Failed to update checklist item");
  }

  return response.json();
};

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { 
    data, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const checklistMutation = useMutation({
    mutationFn: updateChecklistItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleChecklistAction = async (key: string) => {
    switch (key) {
      case "connectJira":
        // Redirect to settings page integrations tab to connect Jira
        window.location.href = "/settings?tab=integrations";
        break;
      case "configureLLM":
        // Navigate to settings page
        window.location.href = "/settings#llm";
        break;
      case "chooseStorageMode":
        // Navigate to settings page
        window.location.href = "/settings#storage";
        break;
      case "firstSuite":
        // Navigate to create suite page
        window.location.href = "/suites/create";
        break;
      case "explore":
        // Navigate to main suites page
        window.location.href = "/suites";
        break;
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "createSuite":
        window.location.href = "/suites/create";
        break;
      case "searchStories":
        window.location.href = "/stories";
        break;
      case "generateTests":
        window.location.href = "/generator";
        break;
      case "exportSuite":
        window.location.href = "/suites?action=export";
        break;
      case "importSuite":
        window.location.href = "/suites?action=import";
        break;
      case "settings":
        window.location.href = "/settings";
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

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
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="text-center">
          <p className="text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  const completedChecklist = Object.values(data.checklist).every(Boolean);

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
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
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6">
          <ConnectionCard 
            connection={data.jiraConnection}
            onConnect={() => handleChecklistAction("connectJira")}
            onManage={() => window.location.href = "/settings#jira"}
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

        {/* Middle Column */}
        <div className="space-y-6">
          {!completedChecklist && (
            <GettingStarted
              checklist={data.checklist}
              onItemAction={handleChecklistAction}
            />
          )}
          
          <RecentStories
            stories={data.recentStories}
            onViewAll={() => window.location.href = "/stories"}
            onGenerateTests={(story) => 
              window.location.href = `/generator?issueKey=${story.key}`
            }
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <ActivityFeed
            events={data.recentActivity}
            showLimit={8}
          />
          
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
                    <div className="text-xs text-muted-foreground mb-1">
                      Connected to
                    </div>
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