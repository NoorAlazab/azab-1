"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, AlertCircle, CheckCircle2, ExternalLink, MessageSquare, Bug as BugIcon } from "lucide-react";
import type { Bug, ExplorationRun } from "@/lib/exploration/types";
import { fetchWithCsrf } from "@/lib/client/csrf";

interface FindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  run: ExplorationRun;
}

export function FindingsModal({ isOpen, onClose, run }: FindingsModalProps) {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publishingBugId, setPublishingBugId] = useState<string | null>(null);

  // Fetch bugs when modal opens
  useEffect(() => {
    if (isOpen && run.id) {
      fetchBugs();
    }
  }, [isOpen, run.id]);

  const fetchBugs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/exploration/bugs?runId=${run.id}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setBugs(data.bugs || []);
      }
    } catch (error) {
      console.error("Failed to fetch bugs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (bugId: string, mode: "comment" | "ticket") => {
    setPublishingBugId(bugId);

    try {
      const response = await fetchWithCsrf("/api/exploration/bugs/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          runId: run.id,
          bugId,
          mode,
        }),
      });

      if (response.ok) {
        // Refresh bugs list
        await fetchBugs();
      } else {
        const error = await response.json();
        alert(`Failed to publish: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Publish error:", error);
      alert("Failed to publish bug");
    } finally {
      setPublishingBugId(null);
    }
  };

  const getSeverityColor = (severity: Bug["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-red-600 text-white";
      case "high":
        return "bg-orange-600 text-white";
      case "medium":
        return "bg-yellow-600 text-white";
      case "low":
        return "bg-blue-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const getStatusBadge = (jiraStatus: Bug["jiraStatus"]) => {
    switch (jiraStatus) {
      case "published_comment":
        return <Badge variant="outline" className="text-green-600">Published as Comment</Badge>;
      case "published_bug":
        return <Badge variant="outline" className="text-green-600">Published as Bug</Badge>;
      case "publishing":
        return <Badge variant="secondary">Publishing...</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Not Published</Badge>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Exploration Findings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Run #{run.id.split('_').pop()?.substring(0, 8)} - {bugs.length} bug{bugs.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="bugs" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bugs">
                <BugIcon className="h-4 w-4 mr-2" />
                Bugs ({bugs.length})
              </TabsTrigger>
              <TabsTrigger value="overview">
                Overview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bugs" className="space-y-4 mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : bugs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <p className="text-lg font-medium">No bugs found!</p>
                  <p className="text-sm">The exploration completed without detecting any issues.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bugs.map((bug) => (
                    <div key={bug.id} className="border rounded-lg p-4 space-y-3">
                      {/* Bug Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getSeverityColor(bug.severity)}>
                              {bug.severity}
                            </Badge>
                            <Badge variant="outline">{bug.category.replace('_', ' ')}</Badge>
                            {getStatusBadge(bug.jiraStatus)}
                          </div>
                          <h3 className="font-semibold text-lg">{bug.title}</h3>
                        </div>
                      </div>

                      {/* Bug Description */}
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {bug.description}
                      </p>

                      {/* Evidence */}
                      {bug.evidence.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Evidence:</h4>
                          <div className="space-y-2">
                            {bug.evidence.map((evidence, index) => (
                              <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">{evidence.type.replace('_', ' ')}</Badge>
                                  {evidence.description && (
                                    <span className="text-muted-foreground">{evidence.description}</span>
                                  )}
                                </div>
                                {evidence.type === "screenshot" ? (
                                  <img
                                    src={evidence.content}
                                    alt="Screenshot evidence"
                                    className="mt-2 max-h-48 rounded border"
                                  />
                                ) : (
                                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words mt-2">
                                    {evidence.content.substring(0, 500)}
                                    {evidence.content.length > 500 && "..."}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {run.source.type === "story" && (
                        <div className="flex gap-2 pt-2 border-t">
                          {bug.jiraStatus === "not_published" || bug.jiraStatus === "failed" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePublish(bug.id, "comment")}
                                disabled={publishingBugId === bug.id}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Publish as Comment
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePublish(bug.id, "ticket")}
                                disabled={publishingBugId === bug.id}
                              >
                                <BugIcon className="h-4 w-4 mr-2" />
                                Create Bug Ticket
                              </Button>
                            </>
                          ) : bug.jiraIssueKey ? (
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={`https://jira.atlassian.com/browse/${bug.jiraIssueKey}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View in Jira ({bug.jiraIssueKey})
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                  <p className="text-2xl font-bold mt-1 capitalize">{run.status}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Progress</h3>
                  <p className="text-2xl font-bold mt-1">{run.progress}%</p>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Bugs Found</h3>
                  <p className="text-2xl font-bold mt-1">{bugs.length}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Published</h3>
                  <p className="text-2xl font-bold mt-1">
                    {bugs.filter(b => b.jiraStatus === "published_comment" || b.jiraStatus === "published_bug").length}
                  </p>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">Run Configuration</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Environment:</dt>
                    <dd className="font-mono">{run.config.envUrl}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Role:</dt>
                    <dd className="capitalize">{run.config.role.replace('_', ' ')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Mode:</dt>
                    <dd className="capitalize">{run.config.mode}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Time Budget:</dt>
                    <dd>{run.config.timeBudgetMins} minutes</dd>
                  </div>
                </dl>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
