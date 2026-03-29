"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Eye, Clock, FileText, ExternalLink, RefreshCw, Bug } from "lucide-react";
import { getStatusBadgeVariant, formatFileSize } from "@/lib/exploration/service";
import { FindingsModal } from "@/components/exploration/FindingsModal";
import type { ExplorationRun } from "@/lib/exploration/types";

interface RunsTableProps {
  className?: string;
}

const fetchRuns = async (): Promise<ExplorationRun[]> => {
  const response = await fetch("/api/exploration/runs", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch runs");
  }

  const data = await response.json();
  return data.runs;
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
};

const getSourceDisplay = (source: ExplorationRun['source']) => {
  if (source.type === "story") {
    return {
      icon: <ExternalLink className="h-4 w-4" />,
      primary: source.key,
      secondary: "Jira Story",
    };
  } else {
    return {
      icon: <FileText className="h-4 w-4" />,
      primary: source.filename,
      secondary: formatFileSize(source.size),
    };
  }
};

export function RunsTable({ className }: RunsTableProps) {
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [selectedRun, setSelectedRun] = useState<ExplorationRun | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    data: runs = [],
    isLoading,
    error,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ["exploration-runs"],
    queryFn: fetchRuns,
    refetchInterval: pollingEnabled ? 3000 : false, // Poll every 3 seconds
  });

  // Stop polling if all runs are in terminal states
  useEffect(() => {
    const hasActiveRuns = runs.some(run =>
      run.status === "queued" || run.status === "running"
    );
    setPollingEnabled(hasActiveRuns);
  }, [runs]);

  const handleViewFindings = (run: ExplorationRun) => {
    setSelectedRun(run);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRun(null);
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base font-medium text-red-600">
            Error Loading Runs
          </CardTitle>
          <CardDescription>
            {error instanceof Error ? error.message : "Failed to load exploration runs"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">Exploration Runs</CardTitle>
            <CardDescription>
              Track your exploration sessions and view findings
            </CardDescription>
          </div>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm"
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No exploration runs yet</h3>
            <p className="text-sm">
              Start your first exploration by selecting a source and configuring the run above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Bugs</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const source = getSourceDisplay(run.source);
                  
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-xs">
                        {run.id.split('_').pop()?.substring(0, 8)}...
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {source.icon}
                          <div>
                            <div className="text-sm font-medium">{source.primary}</div>
                            <div className="text-xs text-muted-foreground">{source.secondary}</div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="secondary">
                          {run.config.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline">
                          {run.config.mode}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(run.status)}>
                          {run.status}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1 min-w-[100px]">
                          <Progress value={run.progress} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {run.progress}%
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {run.status === "completed" ? (
                          <div className="flex items-center gap-1">
                            <Bug className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{run.bugCount || 0}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-sm">
                        {formatTimeAgo(run.createdAt)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={run.status !== "completed"}
                          onClick={() => handleViewFindings(run)}
                          className="text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Findings
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {selectedRun && (
        <FindingsModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          run={selectedRun}
        />
      )}
    </Card>
  );
}