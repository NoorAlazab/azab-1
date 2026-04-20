'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, CheckCircle2, PlayCircle, Circle } from 'lucide-react';
import { useState } from 'react';

interface TestCase {
  id: string;
  title: string;
  steps: string[];
  expected: string;
  priority?: string;
  type?: string;
}

interface TestCasesReviewProps {
  testCases: TestCase[];
  onStartTesting: () => void;
  onRecordSelectors?: () => void;
  isExecuting: boolean;
  isRecording?: boolean;
  recordingNeeded: boolean;
}

export function TestCasesReview({
  testCases,
  onStartTesting,
  onRecordSelectors,
  isExecuting,
  isRecording = false,
  recordingNeeded
}: TestCasesReviewProps) {
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  const toggleCase = (caseId: string) => {
    const newExpanded = new Set(expandedCases);
    if (newExpanded.has(caseId)) {
      newExpanded.delete(caseId);
    } else {
      newExpanded.add(caseId);
    }
    setExpandedCases(newExpanded);
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'P0':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'P1':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'P2':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'P3':
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
            <CardTitle>Generated Test Cases ({testCases.length})</CardTitle>
            <CardDescription>
              {recordingNeeded
                ? "Record element selectors before running tests"
                : "Review the test cases that will be executed against your environment"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {recordingNeeded && onRecordSelectors && (
              <Button
                onClick={onRecordSelectors}
                disabled={isRecording || testCases.length === 0}
                variant="outline"
                className="gap-2"
              >
                {isRecording ? (
                  <>
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Circle className="h-4 w-4" />
                    Record Selectors First
                  </>
                )}
              </Button>
            )}
            {!recordingNeeded && (
              <Button
                onClick={onStartTesting}
                disabled={isExecuting || testCases.length === 0}
                className="gap-2"
              >
                {isExecuting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    Start Testing
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {testCases.map((testCase, index) => (
            <div key={testCase.id} className="border rounded-lg">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-muted-foreground">#{index + 1}</span>
                      <h4 className="font-medium">{testCase.title}</h4>
                      {testCase.priority && (
                        <Badge className={getPriorityColor(testCase.priority)}>
                          {testCase.priority}
                        </Badge>
                      )}
                      {testCase.type && (
                        <Badge variant="outline" className="capitalize">
                          {testCase.type}
                        </Badge>
                      )}
                    </div>

                    {/* Test Steps - Show first 2, then expandable */}
                    <div className="text-sm space-y-1 mb-2">
                      <p className="text-muted-foreground font-medium">Steps:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        {testCase.steps.slice(0, 2).map((step, stepIndex) => (
                          <li key={stepIndex} className="text-muted-foreground">
                            {step}
                          </li>
                        ))}
                      </ol>
                      {testCase.steps.length > 2 && (
                        <Collapsible
                          open={expandedCases.has(testCase.id)}
                          onOpenChange={() => toggleCase(testCase.id)}
                        >
                          <CollapsibleContent>
                            <ol className="list-decimal list-inside space-y-1" start={3}>
                              {testCase.steps.slice(2).map((step, stepIndex) => (
                                <li key={stepIndex + 2} className="text-muted-foreground">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </CollapsibleContent>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-xs mt-1">
                              {expandedCases.has(testCase.id) ? (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  Show less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  Show {testCase.steps.length - 2} more steps
                                </>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </Collapsible>
                      )}
                    </div>

                    {/* Expected Result */}
                    <div className="text-sm bg-green-50 dark:bg-green-950 rounded p-2">
                      <span className="font-medium text-green-700 dark:text-green-400">
                        Expected:
                      </span>
                      <p className="text-muted-foreground mt-1">{testCase.expected}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {testCases.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No test cases generated. Try analyzing a story first.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
