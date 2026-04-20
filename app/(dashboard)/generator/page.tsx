"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Zap, AlertCircle, RefreshCw, Send, Search, MessageSquare, ListTodo, Save, Globe } from "lucide-react";
import { TestCasesList } from "@/components/generator/TestCasesList";
import { GenerationDialog } from "@/components/generator/GenerationDialog";
import { PageContainer } from "@/components/ui/section";
import { IntegrationStatusChip } from "@/components/layout/IntegrationStatusChip";
import { parseIssueKey } from "@/lib/server/jira/issueKey";
import type { WriteMode, TestStep } from "@/lib/server/generator/types";
import { useCsrfToken } from "@/components/useCsrf";
import { useToast } from "@/hooks/use-toast";
import { ResultModal } from "@/components/ui/result-modal";
import { toDisplayDetail } from "@/lib/utils/safeStringify";
import type { StoryItem, BulkPublishResult, TestCaseDTO } from "./_internal/types";
import { transformJiraResponse } from "./_internal/utils";
import { BulkResultsModal } from "./_internal/BulkResultsModal";
import { StoryItemCard } from "./_internal/StoryItemCard";

export default function GeneratorPage() {
  const searchParams = useSearchParams();
  const initialIssueKey = searchParams.get("issueKey") || "";
  
  // Core state
  const [items, setItems] = useState<StoryItem[]>([]);
  const [issueKey, setIssueKey] = useState(initialIssueKey);
  const [storyLink, setStoryLink] = useState("");
  const [loadExistingCases, setLoadExistingCases] = useState(true);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [publishAllLoading, setPublishAllLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkPublishResult | null>(null);
  
  // Generation dialog state
  const [showGenerationDialog, setShowGenerationDialog] = useState(false);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [currentStoryForGeneration, setCurrentStoryForGeneration] = useState<string | null>(null);
  const [generationConfig, setGenerationConfig] = useState<{
    mode: "overwrite" | "append";
    coverage: string[];
    maxCases: number;
  } | null>(null);

  // Get connection info (using same approach as old generator)
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) throw new Error("Not authenticated");
      return response.json();
    },
    retry: false,
  });

  const { token: csrf, loading: csrfLoading } = useCsrfToken();
  const { toast } = useToast();

  // Check if active Jira site is selected (same as old generator)
  const hasActiveJiraSite = sessionData?.jira?.cloudId;
  const jiraConnected = sessionData?.jira?.connected;
  const connected = !sessionLoading && jiraConnected && hasActiveJiraSite;
  const activeCloudId = sessionData?.jira?.cloudId;

  const commonInit = {
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf || "",
    },
  };

  // Utility functions
  const ensureSuite = async (issueKey: string, cloudId: string, environment?: string, loadCases: boolean = true) => {
    const response = await fetch("/api/generator/suite", {
      method: "POST",
      ...commonInit,
      body: JSON.stringify({ issueKey, cloudId }),
    });

    if (!response.ok) throw new Error("Failed to create suite");
    
    const data = await response.json();
    return {
      suiteId: data.suite.id,
      cases: loadCases ? (data.cases || []) : [],
      dirty: data.suite.dirty || false,
      lastSavedAt: data.suite.lastSavedAt ? new Date(data.suite.lastSavedAt) : null
    };
  };

  const convertApiToUi = (apiCase: any): TestCaseDTO => {
    // Convert steps to proper TestStep format
    let steps: TestStep[] = [];
    if (Array.isArray(apiCase.steps)) {
      steps = apiCase.steps.map((step: any) => {
        if (typeof step === 'string') {
          return { action: step, expected: '' };
        } else if (step && typeof step === 'object') {
          return {
            action: step.action || String(step),
            expected: step.expected || ''
          };
        }
        return { action: String(step), expected: '' };
      });
    }

    return {
      id: apiCase.id,
      title: apiCase.title,
      description: apiCase.description,
      steps,
      expected: apiCase.expected || "",
      priority: apiCase.priority || "P2",
      type: apiCase.type || "functional",
      preconditions: apiCase.preconditions || [],
      tags: apiCase.tags || []
    };
  };

  const handleStoryLinkChange = (value: string) => {
    setStoryLink(value);
    
    // Try to auto-extract issue key if the field is empty or different
    if (value.trim()) {
      const extractedKey = parseIssueKey(value);
      if (extractedKey && (!issueKey || issueKey !== extractedKey)) {
        setIssueKey(extractedKey);
      }
    }
  };

  // Fetch story and add to items
  const handleFetch = async () => {
    // If issue key is empty but we have a story link, try to parse it
    let finalIssueKeys = issueKey.trim();
    if (!finalIssueKeys && storyLink.trim()) {
      const parsed = parseIssueKey(storyLink) || "";
      if (parsed) {
        setIssueKey(parsed);
        finalIssueKeys = parsed;
      }
    }
    
    if (!finalIssueKeys || !activeCloudId) return;

    const keys = finalIssueKeys.split(",").map(k => k.trim().toUpperCase());
    
    setIsLoadingStory(true);
    try {
      for (const key of keys) {
        // Skip if already exists
        if (items.some(item => item.issueKey === key)) continue;

        const response = await fetch(`/api/jira/issue/${key}`, {
          ...commonInit,
        });

        if (!response.ok) throw new Error(`Failed to fetch ${key}`);
        
        const rawStory = await response.json();
        const story = transformJiraResponse(rawStory);

        // Ensure suite exists
        const { suiteId, cases, dirty, lastSavedAt } = await ensureSuite(key, activeCloudId, "", loadExistingCases);

        // Add to items
        const newItem: StoryItem = {
          suiteId,
          issueKey: key,
          cloudId: activeCloudId,
          story,
          environment: "",
          cases: cases.map(convertApiToUi),
          dirty: dirty,
          lastSavedAt: lastSavedAt,
          publishMode: "comment",
          saving: false,
          publishing: false,
        };

        setItems(prev => [...prev, newItem]);
        
        toast({
          title: "Story Fetched",
          description: `Added ${key} to workspace.`,
        });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast({
        variant: "destructive",
        title: "Fetch Failed", 
        description: error instanceof Error ? error.message : "Failed to fetch story",
      });
    } finally {
      setIsLoadingStory(false);
    }
  };

  // Save individual story
  const handleSaveStory = async (issueKey: string) => {
    const itemIndex = items.findIndex(item => item.issueKey === issueKey);
    if (itemIndex === -1) return;

    const item = items[itemIndex];
    if (!item.suiteId) return;

    // Set saving state
    setItems(prev => prev.map((item, i) => 
      i === itemIndex ? { ...item, saving: true } : item
    ));

    try {
      const response = await fetch("/api/generator/suite/save", {
        method: "POST",
        ...commonInit,
        body: JSON.stringify({
          suiteId: item.suiteId,
          environment: item.environment,
          cases: cleanCasesForApi(item.cases)
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Save failed" }));
        throw new Error(error.error);
      }

      // Mark as clean and update lastSavedAt
      setItems(prev => prev.map((item, i) => 
        i === itemIndex ? { ...item, dirty: false, lastSavedAt: new Date(), saving: false } : item
      ));

      toast({
        title: "💾 Saved",
        description: `Saved ${item.cases.length} test cases.`,
      });

    } catch (error) {
      console.error("Save error:", error);
      setItems(prev => prev.map((item, i) => 
        i === itemIndex ? { ...item, saving: false } : item
      ));
      
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save",
      });
    }
  };

  // Publish individual story
  const handlePublishStory = async (issueKey: string) => {
    const itemIndex = items.findIndex(item => item.issueKey === issueKey);
    if (itemIndex === -1) return;

    const item = items[itemIndex];
    if (!item.suiteId || item.cases.length === 0) return;

    // Client-side dirty check
    if (item.dirty) {
      toast({
        variant: "destructive", 
        title: "Unsaved Changes",
        description: "You have unsaved changes. Save first."
      });
      return;
    }

    // Set publishing state
    setItems(prev => prev.map((item, i) => 
      i === itemIndex ? { ...item, publishing: true } : item
    ));

    try {
      const response = await fetch("/api/jira/publish", {
        method: "POST",
        ...commonInit,
        body: JSON.stringify({
          suiteId: item.suiteId,
          mode: item.publishMode
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const message = item.publishMode === "comment" 
          ? `Published test cases to ${issueKey} as a comment.`
          : `Created ${result.created?.length || 0} sub-tasks under ${issueKey}.`;

        setItems(prev => prev.map((item, i) => 
          i === itemIndex ? { 
            ...item, 
            publishing: false,
            lastResult: { ok: true, message }
          } : item
        ));

        toast({
          title: "Published",
          description: message,
        });
      } else {
        // Show server error message if available
        const serverMessage = result.message || result.error || "Publish failed";
        throw new Error(serverMessage);
      }

    } catch (error) {
      console.error("Publish error:", error);
      const errorMessage = error instanceof Error ? error.message : "Publish failed";
      
      setItems(prev => prev.map((item, i) => 
        i === itemIndex ? { 
          ...item, 
          publishing: false,
          lastResult: { ok: false, message: errorMessage }
        } : item
      ));
      
      toast({
        variant: "destructive",
        title: "Publish Failed",
        description: errorMessage,
      });
    }
  };

  // Add test cases to story
  const handleAddTestCases = (issueKey: string) => {
    setCurrentStoryForGeneration(issueKey);
    setShowGenerationDialog(true);
  };

  // Generation dialog confirm
  const handleGenerationConfirm = async (config: any) => {
    if (!currentStoryForGeneration) return;

    const itemIndex = items.findIndex(item => item.issueKey === currentStoryForGeneration);
    if (itemIndex === -1) return;

    const item = items[itemIndex];
    
    setGenerationLoading(true);
    setShowGenerationDialog(false);

    try {
      const response = await fetch("/api/generator/draft", {
        method: "POST",
        ...commonInit,
        body: JSON.stringify({
          suiteId: item.suiteId,
          issueKey: item.issueKey,
          cloudId: item.cloudId,
          story: item.story,
          mode: config.mode,
          coverage: Array.isArray(config.coverage) ? config.coverage.join(',') : config.coverage,
          maxCases: config.maxCases
        }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();
      const newCases = (data.cases || []).map(convertApiToUi);

      // Update item with new cases and mark dirty
      setItems(prev => prev.map((item, i) => 
        i === itemIndex ? { 
          ...item, 
          cases: newCases,
          dirty: true 
        } : item
      ));

      toast({
        title: "Test Cases Generated",
        description: `Generated ${newCases.length} test cases for ${currentStoryForGeneration}.`,
      });

    } catch (error) {
      console.error("Generation error:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate test cases",
      });
    } finally {
      setGenerationLoading(false);
      setCurrentStoryForGeneration(null);
    }
  };

  // Clean serialization function to remove circular references
  const cleanCasesForApi = (cases: TestCaseDTO[]): any[] => {
    return cases.map(testCase => ({
      id: testCase.id,
      title: testCase.title,
      description: testCase.description,
      steps: Array.isArray(testCase.steps) ? testCase.steps.map(step => ({
        action: step.action,
        expected: step.expected,
        data: step.data
      })) : [],
      expected: testCase.expected,
      priority: testCase.priority,
      type: testCase.type,
      preconditions: testCase.preconditions || [],
      tags: testCase.tags || []
    }));
  };

  // Publish All
  const handlePublishAll = async () => {
    const itemsWithCases = items.filter(item => item.cases.length > 0);
    if (itemsWithCases.length === 0) return;

    // Check for dirty suites and show confirmation dialog
    const dirtyItems = itemsWithCases.filter(item => item.dirty);
    if (dirtyItems.length > 0) {
      const confirmed = window.confirm(
        `${dirtyItems.length} stories have unsaved changes. We will skip those. Continue publishing the saved ones?`
      );
      if (!confirmed) return;
    }

    setPublishAllLoading(true);

    try {
      // Prepare payloads for dirty items
      const payloads: Record<string, any> = {};
      const suiteIds: string[] = [];

      itemsWithCases.forEach(item => {
        if (!item.suiteId) return;
        
        suiteIds.push(item.suiteId);
        
        if (item.dirty) {
          payloads[item.suiteId] = {
            environment: item.environment,
            cases: cleanCasesForApi(item.cases)
          };
        }
      });

      const response = await fetch("/api/jira/publish/bulk", {
        method: "POST",
        ...commonInit,
        body: JSON.stringify({
          suiteIds,
          mode: "comment", // Default mode, could be made configurable
          payloads
        }),
      });

      if (!response.ok) throw new Error("Bulk publish failed");

      const results = await response.json();
      
      // Sanitize results to prevent circular references
      const sanitizedResults = {
        ...results,
        results: results.results?.map((result: any) => ({
          ...result,
          detail: toDisplayDetail(result.detail)
        })) || []
      };
      
      setBulkResults(sanitizedResults);
      setShowResults(true);

      // Update results and only mark successfully published items as clean
      setItems(prev => prev.map(item => {
        const result = results.results.find((r: any) => 
          r.issueKey === item.issueKey
        );
        
        if (result && result.ok) {
          // Only mark as clean if successfully published
          return {
            ...item,
            dirty: false,
            lastSavedAt: new Date(),
            lastResult: {
              ok: result.ok,
              message: result.message
            }
          };
        } else if (result) {
          // Keep dirty flag for failed items
          return {
            ...item,
            lastResult: {
              ok: result.ok,
              message: result.message
            }
          };
        }
        
        return item;
      }));

      // Show appropriate toast based on results
      if (results.failures === 0) {
        toast({
          title: "Publish Complete",
          description: `Published ${results.successes}/${results.total}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Publish Partially Failed", 
          description: `Published ${results.successes}/${results.total}.`,
        });
      }

    } catch (error) {
      console.error("Bulk publish error:", error);
      toast({
        variant: "destructive",
        title: "Bulk Publish Failed",
        description: error instanceof Error ? error.message : "Failed to publish all",
      });
    } finally {
      setPublishAllLoading(false);
    }
  };

  // Update story data
  const updateStoryItem = (issueKey: string, updates: Partial<StoryItem>) => {
    setItems(prev => prev.map(item => 
      item.issueKey === issueKey ? { ...item, ...updates } : item
    ));
  };

  // Auth check
  if (sessionLoading) {
    return (
      <PageContainer>
        <Card className="rounded-2xl shadow-sm border p-5">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Checking authentication...</p>
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (!connected) {
    return (
      <PageContainer>
        <Card className="rounded-2xl shadow-sm border p-5">
          <div className="text-center py-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Jira Connection Required</h3>
              <p className="text-muted-foreground">
                Connect your Jira account to generate and publish test cases.
              </p>
            </div>
            <Button asChild>
              <Link href="/settings?tab=integrations">
                <Globe className="h-4 w-4 mr-2" />
                Connect Jira
              </Link>
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Top Bar */}
        <Card className="rounded-2xl shadow-sm border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-semibold">Test Case Generator</h1>
                <p className="text-sm text-muted-foreground">
                  Generate and publish test cases to Jira.
                </p>
              </div>
              <IntegrationStatusChip />
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="gap-2"
                onClick={handlePublishAll}
                disabled={publishAllLoading || items.filter(i => i.cases.length > 0).length === 0}
              >
                <Send className="h-4 w-4" />
                {publishAllLoading ? "Publishing..." : "Publish All"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Fetch Row */}
        <Card className="rounded-2xl shadow-sm border p-6">
          <div className="space-y-4">
            {/* Input Fields Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="storyLink" className="text-sm font-medium text-gray-700">
                  Story Link
                </Label>
                <Input
                  id="storyLink"
                  value={storyLink}
                  onChange={(e) => handleStoryLinkChange(e.target.value)}
                  placeholder="https://your-site.atlassian.net/browse/PROJ-123"
                  className="h-10 transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoadingStory}
                />
                <p className="text-xs text-gray-500">
                  Optional Jira URL (auto-fills key)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="issueKey" className="text-sm font-medium text-gray-700">
                  Issue Key(s) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="issueKey"
                  value={issueKey}
                  onChange={(e) => setIssueKey(e.target.value.toUpperCase())}
                  placeholder="e.g., PROJ-123, PROJ-456"
                  className="h-10 transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoadingStory}
                />
                <p className="text-xs text-gray-500">
                  Single key or multiple keys separated by commas
                </p>
              </div>
              
              {/* Fetch Button */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 opacity-0">
                  Button
                </Label>
                <Button
                  onClick={handleFetch}
                  disabled={(!issueKey.trim() && !storyLink.trim()) || isLoadingStory || !connected}
                  className="gap-2 h-10 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors min-w-[130px] w-full"
                  size="default"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingStory ? 'animate-spin' : ''}`} />
                  {isLoadingStory ? "Fetching..." : "Fetch Stories"}
                </Button>
                <p className="text-xs text-gray-500 opacity-0">
                  Spacer text
                </p>
              </div>
            </div>
            
            {/* Options */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="loadExistingCases"
                checked={loadExistingCases}
                onChange={(e) => setLoadExistingCases(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isLoadingStory}
              />
              <Label htmlFor="loadExistingCases" className="text-sm text-gray-700 cursor-pointer">
                Load existing test cases (if any)
              </Label>
            </div>
          </div>
          
          {/* Connection Status Indicator */}
          {!connected && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Jira connection required</span>
              </div>
              <p className="text-xs text-yellow-700 mt-1">
                Connect to Jira to fetch and publish test cases
              </p>
            </div>
          )}
        </Card>

        {/* Story Cards Grid */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {items.map((item) => (
              <StoryItemCard
                key={item.issueKey}
                item={item}
                onSave={() => handleSaveStory(item.issueKey)}
                onPublish={() => handlePublishStory(item.issueKey)}
                onAddTestCases={() => handleAddTestCases(item.issueKey)}
                onUpdate={(updates) => updateStoryItem(item.issueKey, updates)}
                disabled={!connected || csrfLoading}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 && (
          <Card className="rounded-2xl shadow-sm border p-8">
            <div className="text-center space-y-4">
              <Search className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">No Stories Loaded</h3>
                <p className="text-muted-foreground">
                  Enter an issue key above and click Fetch to get started.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Generation Dialog */}
        <GenerationDialog
          open={showGenerationDialog}
          onClose={() => setShowGenerationDialog(false)}
          onGenerate={handleGenerationConfirm}
          hasExistingCases={(items.find(i => i.issueKey === currentStoryForGeneration)?.cases.length ?? 0) > 0}
        />

        {/* Results Modal */}
        {showResults && bulkResults && (
          <BulkResultsModal
            isOpen={true}
            onClose={() => setShowResults(false)}
            results={bulkResults}
          />
        )}
      </div>
    </PageContainer>
  );
}
