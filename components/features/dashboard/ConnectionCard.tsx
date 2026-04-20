"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, ExternalLink, Settings, AlertCircle, Globe } from "lucide-react";
import { toast } from "sonner";
import type { JiraSite } from "@/types/auth";

export interface JiraConnection {
  isConnected?: boolean;
  connected?: boolean;
  siteName?: string;
  cloudId?: string;
  scopes?: string[];
  expiresAt?: string;
  activeCloudId?: string | null;
  activeSiteName?: string | null;
  sites?: JiraSite[];
}

export interface ConnectionCardProps {
  connection?: JiraConnection;
  onConnect?: () => void;
  onManage?: () => void;
}

interface JiraSitesResponse {
  items: JiraSite[];
  activeCloudId?: string | null;
  activeSiteName?: string | null;
  connected: boolean;
}

export function ConnectionCard({ connection, onConnect, onManage }: ConnectionCardProps) {
  const queryClient = useQueryClient();
  
  // Query for Jira sites
  const { data: sitesData, isLoading: sitesLoading } = useQuery<JiraSitesResponse>({
    queryKey: ["jira-sites"],
    queryFn: async () => {
      const response = await fetch("/api/auth/atlassian/sites");
      if (!response.ok) {
        throw new Error("Failed to fetch Jira sites");
      }
      return response.json();
    },
    enabled: connection?.connected || connection?.isConnected,
  });

  // Mutation for setting active site
  const setActiveSiteMutation = useMutation({
    mutationFn: async (cloudId: string) => {
      const response = await fetch("/api/auth/atlassian/site", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cloudId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to set active site");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Active site set to ${data.activeSiteName}`);
      // Invalidate and refetch sites data
      queryClient.invalidateQueries({ queryKey: ["jira-sites"] });
      // Also invalidate session data if you have it
      queryClient.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Use either the prop connection or the fetched sites data
  const isConnected = connection?.connected || connection?.isConnected || sitesData?.connected || false;
  const sites = sitesData?.items || connection?.sites || [];
  const activeCloudId = sitesData?.activeCloudId || connection?.activeCloudId;
  const activeSiteName = sitesData?.activeSiteName || connection?.activeSiteName;

  const handleSiteChange = (cloudId: string) => {
    setActiveSiteMutation.mutate(cloudId);
  };

  const needsSiteSelection = isConnected && sites.length > 1 && !activeCloudId;
  const hasMultipleSites = sites.length > 1;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Jira Connection
          </CardTitle>
          <CardDescription>
            {isConnected 
              ? activeSiteName 
                ? `Connected to ${activeSiteName}`
                : sites.length > 1 
                  ? "Multiple sites available - select one"
                  : "Connected to Jira"
              : "Connect to your Jira instance"
            }
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          {isConnected ? (
            needsSiteSelection ? (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Site selection warning */}
        {needsSiteSelection && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Multiple Jira sites detected. Select one to continue using the Generator and other features.
            </AlertDescription>
          </Alert>
        )}

        {/* Site selector */}
        {isConnected && hasMultipleSites && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Active Jira Site:</label>
            <Select
              value={activeCloudId || ""}
              onValueChange={handleSiteChange}
              disabled={setActiveSiteMutation.isPending || sitesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a Jira site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    <div className="flex flex-col">
                      <span>{site.name}</span>
                      <span className="text-xs text-muted-foreground">{site.url}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Single site display */}
        {isConnected && sites.length === 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Jira Site:</span>
              <Badge variant="secondary">{sites[0].name}</Badge>
            </div>
          </div>
        )}

        {/* Connection status and scopes */}
        {isConnected && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant="default">Connected</Badge>
            </div>
            
            {(connection?.scopes || sitesData?.items?.[0]?.scopes) && (
              <div className="space-y-1">
                <span className="text-sm font-medium">Permissions:</span>
                <div className="flex flex-wrap gap-1">
                  {(connection?.scopes || sitesData?.items?.[0]?.scopes || []).slice(0, 3).map((scope) => (
                    <Badge key={scope} variant="outline" className="text-xs">
                      {scope.replace("read:", "").replace("write:", "")}
                    </Badge>
                  ))}
                  {(connection?.scopes?.length || 0) > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{(connection?.scopes?.length || 0) - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Link href="/settings?tab=integrations" className="flex-1">
            <Button variant={isConnected ? "outline" : "default"} className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              {isConnected ? "Manage Integrations" : "Connect Jira"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}