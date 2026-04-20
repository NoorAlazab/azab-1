'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, FileText, Clock } from 'lucide-react';

interface TestStepResult {
  step: string;
  success: boolean;
  error?: string;
  duration: number;
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
  executionLog?: TestStepResult[];
  duration?: number;
}

interface TestResultsProps {
  results: TestResult[];
  runStatus: 'running' | 'completed' | 'failed';
  summary?: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
  };
}

export function TestResults({ results, runStatus, summary }: TestResultsProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'running':
        return <Clock className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'error':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Test Execution Results</CardTitle>
            <CardDescription>
              {runStatus === 'running' ? 'Tests are running...' : 'Test execution completed'}
            </CardDescription>
          </div>
          {summary && (
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
                <div className="text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                <div className="text-muted-foreground">Failed</div>
              </div>
              {summary.errors > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{summary.errors}</div>
                  <div className="text-muted-foreground">Errors</div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {results.map((result, index) => (
            <Collapsible key={result.id} className="border rounded-lg">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">
                          Test {index + 1}: {result.title}
                        </h4>
                        <Badge className={getStatusColor(result.status)}>
                          {result.status.toUpperCase()}
                        </Badge>
                        {result.duration && (
                          <span className="text-sm text-muted-foreground">
                            ({(result.duration / 1000).toFixed(2)}s)
                          </span>
                        )}
                      </div>

                      {/* Expected vs Actual */}
                      {result.status === 'failed' && (
                        <div className="bg-red-50 dark:bg-red-950 rounded p-3 mt-2 text-sm space-y-2">
                          <div>
                            <span className="font-semibold text-green-700 dark:text-green-400">
                              Expected:
                            </span>
                            <p className="text-muted-foreground mt-1">{result.expected}</p>
                          </div>
                          {result.actualResult && (
                            <div>
                              <span className="font-semibold text-red-700 dark:text-red-400">
                                Observed:
                              </span>
                              <p className="text-muted-foreground mt-1">{result.actualResult}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {result.status === 'error' && result.errorMessage && (
                        <div className="bg-orange-50 dark:bg-orange-950 rounded p-3 mt-2 text-sm">
                          <span className="font-semibold text-orange-700 dark:text-orange-400">
                            Error:
                          </span>
                          <p className="text-muted-foreground mt-1">{result.errorMessage}</p>
                        </div>
                      )}

                      {/* Screenshot */}
                      {result.screenshotUrl && (
                        <div className="mt-3">
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" size="sm" className="mb-2">
                                <FileText className="h-4 w-4 mr-2" />
                                {result.status === 'passed' ? 'View Success Screenshot' : result.status === 'failed' ? 'View Failure Screenshot' : 'View Error Screenshot'}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                                <img
                                  src={result.screenshotUrl}
                                  alt={`Screenshot for ${result.title}`}
                                  className="w-full h-auto"
                                  loading="lazy"
                                />
                                <div className="p-2 text-center">
                                  <a
                                    href={result.screenshotUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    Open in new tab
                                  </a>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expand button for execution log */}
                  {result.executionLog && result.executionLog.length > 0 && (
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>

                {/* Execution Log */}
                {result.executionLog && result.executionLog.length > 0 && (
                  <CollapsibleContent className="mt-4">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 space-y-2">
                      <h5 className="text-sm font-semibold">Execution Log:</h5>
                      {result.executionLog.map((stepResult, stepIndex) => (
                        <div
                          key={stepIndex}
                          className="flex items-start gap-2 text-sm border-l-2 pl-3"
                          style={{
                            borderColor: stepResult.success ? '#16a34a' : '#dc2626',
                          }}
                        >
                          <div className="flex-1">
                            <div className="font-medium">{stepResult.step}</div>
                            {stepResult.error && (
                              <div className="text-red-600 text-xs mt-1">{stepResult.error}</div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {stepResult.duration}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                )}
              </div>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
