"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { IntegrationStatusChip } from "@/components/layout/IntegrationStatusChip";
import { TestCasesReview } from "@/components/exploration/TestCasesReview";
import { TestResults } from "@/components/exploration/TestResults";
import { RecordingProgressComponent } from "@/components/exploration/RecordingProgress";
import { toast } from "@/hooks/use-toast";
import { fetchWithCsrf } from "@/lib/client/csrf";
import { Loader2, FileText, AlertCircle, Sparkles, Lock, Eye, EyeOff } from "lucide-react";

interface TestCase {
  id: string;
  title: string;
  steps: string[];
  expected: string;
  priority?: string;
  type?: string;
}

interface TestResult {
  id: string;
  title: string;
  steps: string[];
  expected: string;
  status: 'passed' | 'failed' | 'error' | 'pending' | 'running';
  actualResult?: string;
  errorMessage?: string;
  screenshotUrl?: string;
  executionLog?: any[];
  duration?: number;
}

interface RecordingProgress {
  page: string;
  status: 'pending' | 'recording' | 'completed' | 'failed';
  elementCount?: number;
  error?: string;
}

export default function ExplorationV2Page() {
  // Form state
  const [storyKey, setStoryKey] = useState("");
  const [environment, setEnvironment] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saveCredentials, setSaveCredentials] = useState(false);

  // Analyze state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [needsRefinement, setNeedsRefinement] = useState(false);
  const [refinementHint, setRefinementHint] = useState<string>('');

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState<RecordingProgress[]>([]);
  const [needsRecording, setNeedsRecording] = useState<string[]>([]);
  const [requiredPages, setRequiredPages] = useState<string[]>([]);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<'running' | 'completed' | 'failed'>('running');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [resultsSummary, setResultsSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    errors: number;
  } | null>(null);

  // Poll for execution results
  useEffect(() => {
    if (!currentRunId || !isPolling) return;

    let pollCount = 0;
    const maxPolls = 150; // 5 minutes max (150 * 2 seconds)

    const poll = async () => {
      try {
        pollCount++;
        console.log(`[Polling #${pollCount}] Fetching results for runId:`, currentRunId);

        const response = await fetch(`/api/exploration-v2/results?runId=${currentRunId}`);
        if (!response.ok) throw new Error('Failed to fetch results');

        const data = await response.json();
        console.log(`[Polling #${pollCount}] Received data:`, {
          status: data.run.status,
          resultsCount: data.results?.length || 0,
          summary: data.summary
        });

        // Log first 2 results to debug status display
        if (data.results && data.results.length > 0) {
          console.log(`[Polling #${pollCount}] Sample results:`, data.results.slice(0, 2).map((r: any) => ({
            title: r.title,
            status: r.status,
            hasError: !!r.errorMessage
          })));
        }

        setRunStatus(data.run.status);
        setTestResults(data.results || []);
        setResultsSummary(data.summary);

        // Stop polling when completed/failed AND we have results
        if ((data.run.status === 'completed' || data.run.status === 'failed') && data.results && data.results.length > 0) {
          console.log('[Polling] Stopping - test completed with results');
          setIsPolling(false);
          setIsExecuting(false);

          toast({
            title: data.run.status === 'completed' ? "Testing Completed" : "Testing Failed",
            description: data.run.status === 'completed'
              ? `${data.summary.passed}/${data.summary.total} tests passed`
              : "Test execution encountered an error",
            variant: data.run.status === 'completed' ? "default" : "destructive",
          });
        } else if (data.run.status === 'completed' && (!data.results || data.results.length === 0)) {
          // Completed but no results - keep polling a few more times
          console.log('[Polling] Completed but no results yet, continuing to poll...');
        }

        // Timeout after max polls
        if (pollCount >= maxPolls) {
          console.log('[Polling] Timeout - stopping after max polls');
          setIsPolling(false);
          setIsExecuting(false);
          toast({
            title: "Polling Timeout",
            description: "Test execution is taking longer than expected. Please check results manually.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('[Polling] Error:', error);
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [currentRunId, isPolling]);

  const handleAnalyze = async () => {
    if (!storyKey.trim() || !environment.trim()) {
      toast({
        title: "Validation Error",
        description: "Story key and environment are required",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setTestCases([]);
    setTestResults([]);
    setResultsSummary(null);
    setCurrentRunId(null);

    try {
      const response = await fetchWithCsrf('/api/exploration/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyKey: storyKey.trim().toUpperCase(),
          environment: environment.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();
      setPlanId(data.plan.id);
      setTestCases(data.testCases || []);
      setNeedsRefinement(data.needsRefinement || false);
      setRefinementHint(data.refinementHint || '');
      setRequiredPages(data.requiredPages || []);

      // Check which pages need selector recording
      if (data.requiredPages && data.requiredPages.length > 0) {
        const checkResponse = await fetch(
          `/api/exploration-v2/check-selectors?environment=${encodeURIComponent(environment.trim())}&pages=${encodeURIComponent(JSON.stringify(data.requiredPages))}`
        );

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          setNeedsRecording(checkData.needsRecording || []);

          if (checkData.needsRecording.length > 0) {
            toast({
              title: "Selector Recording Required",
              description: `${checkData.needsRecording.length} page(s) need selector recording: ${checkData.needsRecording.join(', ')}`,
              variant: "destructive",
            });
          }
        }
      }

      if (data.needsRefinement) {
        toast({
          title: "Story Analysis Complete",
          description: data.refinementHint || "Test cases generated but may need more details for better quality",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Analysis Complete",
          description: `Generated ${data.testCases.length} test cases from your story`,
        });
      }

    } catch (error) {
      console.error('Analyze error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : 'Failed to analyze story',
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRecordSelectors = async () => {
    // Use requiredPages for journey-based discovery instead of needsRecording
    // If both are empty, the system will discover ALL navigation items automatically
    const pagesToRecord = requiredPages.length > 0 ? requiredPages : needsRecording;

    // Allow recording even with empty pages array - system will discover all navigation
    const discoverAllMode = pagesToRecord.length === 0;

    if (!username || !password) {
      toast({
        title: "Credentials Required",
        description: "Username and password are required to record selectors from protected pages",
        variant: "destructive",
      });
      return;
    }

    console.log('[RecordSelectors] Starting with pages:', pagesToRecord);
    console.log('[RecordSelectors] Discover all mode:', discoverAllMode);
    console.log('[RecordSelectors] Journey mode will be used:', !!(username && password && storyKey));

    if (discoverAllMode) {
      toast({
        title: "Discovering Navigation",
        description: "System will click through ALL navigation items and record selectors for each page found.",
      });
    }

    setIsRecording(true);
    setRecordingProgress(discoverAllMode
      ? [{ page: 'Discovering navigation...', status: 'recording' }]
      : pagesToRecord.map(page => ({ page, status: 'pending' }))
    );

    try {
      const response = await fetchWithCsrf('/api/exploration-v2/record-selectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: environment.trim(),
          username,
          password,
          pages: pagesToRecord,
          storyKey: storyKey.trim().toUpperCase(),
          saveCredentials,
        }),
      });

      console.log('[RecordSelectors] API response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('[RecordSelectors] API error:', error);
        throw new Error(error.error || 'Recording failed');
      }

      const data = await response.json();
      console.log('[RecordSelectors] API response data:', {
        recordedPagesCount: data.recordedPages?.length,
        successfulPages: data.recordedPages?.filter((r: any) => r.success).length,
        totalElements: data.totalElements,
        journeysCount: data.journeys?.length,
      });

      // Update progress with results
      setRecordingProgress(data.recordedPages.map((result: any) => ({
        page: result.page,
        status: result.success ? 'completed' : 'failed',
        elementCount: result.elementsRecorded,
        error: result.error,
      })));

      // Clear needs recording lists - both needsRecording and requiredPages
      setNeedsRecording([]);
      setRequiredPages([]);

      const successCount = data.recordedPages.filter((r: any) => r.success).length;
      const journeyInfo = data.journeys && data.journeys.length > 0
        ? ` (${data.journeys.length} journeys discovered)`
        : '';

      toast({
        title: "Recording Complete",
        description: `Successfully recorded selectors for ${successCount} page(s)${journeyInfo}`,
      });

      // Log journey details if available
      if (data.journeys && data.journeys.length > 0) {
        console.log('[RecordSelectors] Discovered journeys:', data.journeys.map((j: any) => ({
          keyword: j.pageKeyword,
          url: j.actualUrl,
          steps: j.steps?.length,
        })));
      }

    } catch (error) {
      console.error('Recording error:', error);
      toast({
        title: "Recording Failed",
        description: error instanceof Error ? error.message : 'Failed to record selectors',
        variant: "destructive",
      });
    } finally {
      setIsRecording(false);
    }
  };

  const handleStartTesting = async () => {
    if (!planId || testCases.length === 0) {
      toast({
        title: "Error",
        description: "No test cases to execute. Please analyze a story first.",
        variant: "destructive",
      });
      return;
    }

    console.log('[StartTesting] Starting test execution (recording phase should be completed)');

    setIsExecuting(true);

    try {
      // Create exploration run first
      const startResponse = await fetchWithCsrf('/api/exploration-v2/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyKey: storyKey.trim().toUpperCase(),
          environment: environment.trim(),
          planId,
          mode: 'smoke',
        }),
      });

      if (!startResponse.ok) {
        const error = await startResponse.json();
        throw new Error(error.error || 'Failed to start exploration');
      }

      const startData = await startResponse.json();
      const runId = startData.runId;
      setCurrentRunId(runId);

      console.log('[StartTesting] Exploration run created with runId:', runId);
      console.log('[StartTesting] About to call execute API with test cases:', testCases.length);

      // Execute test cases
      const executeResponse = await fetchWithCsrf('/api/exploration-v2/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          testCases,
          environment: environment.trim(),
        }),
      });

      console.log('[StartTesting] Execute API response status:', executeResponse.status);

      if (!executeResponse.ok) {
        const error = await executeResponse.json();
        console.error('[StartTesting] Execute API error:', error);
        throw new Error(error.error || 'Failed to execute tests');
      }

      const executeData = await executeResponse.json();
      console.log('[StartTesting] Execute API response data:', executeData);

      // Show notification if simulated
      if (executeData.simulated) {
        toast({
          title: "Simulated Execution",
          description: "Playwright not available - running simulated test execution for demonstration",
        });
      } else {
        toast({
          title: "Testing Started",
          description: "Running test cases against your environment",
        });
      }

      setIsPolling(true);
      setRunStatus('running');

    } catch (error) {
      console.error('Start testing error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to start testing',
        variant: "destructive",
      });
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Test Case Execution</h1>
            <IntegrationStatusChip />
          </div>
          <p className="text-muted-foreground mt-2">
            Generate test cases from your story, then execute them against your environment with clear pass/fail results
          </p>
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Story Configuration</CardTitle>
          <CardDescription>
            Enter your story details to auto-generate test cases
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="story-key">Story Key *</Label>
              <Input
                id="story-key"
                placeholder="e.g., PROJ-123"
                value={storyKey}
                onChange={(e) => setStoryKey(e.target.value.toUpperCase())}
                disabled={isExecuting || isRecording}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">Environment URL *</Label>
              <Input
                id="environment"
                type="url"
                placeholder="https://staging.example.com"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                disabled={isExecuting || isRecording}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">
                Username
                {needsRecording.length > 0 && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="test@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isExecuting || isRecording}
              />
              <p className="text-xs text-muted-foreground">
                Required for recording selectors from protected pages
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password
                {needsRecording.length > 0 && <span className="text-destructive ml-1">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isExecuting || isRecording}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isExecuting || isRecording}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Required for recording selectors from protected pages
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="save-credentials"
              checked={saveCredentials}
              onCheckedChange={(checked) => setSaveCredentials(checked === true)}
              disabled={isExecuting || isRecording}
            />
            <Label
              htmlFor="save-credentials"
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              <Lock className="h-3 w-3" />
              Save credentials securely for future recordings (encrypted)
            </Label>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={!storyKey || !environment || isAnalyzing || isExecuting || isRecording}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Story...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze & Generate Test Cases
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Refinement warning */}
      {needsRefinement && testCases.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {refinementHint || 'Test cases generated but may be too vague. Consider adding more specific acceptance criteria to your story for better quality.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Selector recording required warning */}
      {needsRecording.length > 0 && !isRecording && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Selector recording required for {needsRecording.length} page(s): {needsRecording.join(', ')}.
            {!username || !password ? ' Please provide credentials above to record selectors.' : ' Selectors will be recorded automatically when you start testing.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Recording Progress */}
      {isRecording && recordingProgress.length > 0 && (
        <RecordingProgressComponent
          pages={recordingProgress}
          totalPages={recordingProgress.length}
        />
      )}

      {/* Test Cases Review */}
      {testCases.length > 0 && !currentRunId && !isRecording && (
        <TestCasesReview
          testCases={testCases}
          onStartTesting={handleStartTesting}
          onRecordSelectors={handleRecordSelectors}
          isExecuting={isExecuting}
          isRecording={isRecording}
          recordingNeeded={needsRecording.length > 0 || requiredPages.length > 0}
        />
      )}

      {/* Test Results */}
      {currentRunId && testResults.length > 0 && (
        <TestResults
          results={testResults}
          runStatus={runStatus}
          summary={resultsSummary || undefined}
        />
      )}

      {/* Loading state during execution */}
      {currentRunId && testResults.length === 0 && (runStatus === 'running' || !resultsSummary) && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">
                {runStatus === 'running'
                  ? 'Executing test cases against your environment...'
                  : 'Loading test results...'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This may take a few minutes depending on the number of tests
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty results state */}
      {currentRunId && testResults.length === 0 && runStatus === 'completed' && resultsSummary && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No Test Results Found</p>
              <p className="text-sm text-muted-foreground mt-2">
                The test execution completed but no results were recorded. This might be a system error.
              </p>
              <Button
                onClick={() => {
                  setCurrentRunId(null);
                  setTestResults([]);
                  setResultsSummary(null);
                }}
                className="mt-4"
                variant="outline"
              >
                Start New Test
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
