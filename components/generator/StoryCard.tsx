import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronRight, ExternalLink, Wand2, Settings, RefreshCw } from 'lucide-react';
import { TestCasesList } from './TestCasesList';
import Link from 'next/link';
import type { JiraStoryDetails } from '@/lib/generator/types';
import type { TestCase } from '@/lib/generator/types';

interface StoryCardProps {
  story: JiraStoryDetails;
  cases: TestCase[];
  onUpdateTestCase: (id: string, updates: Partial<TestCase>) => void;
  onDeleteTestCase: (id: string) => void;
  onAddTestCase: (testCase: Omit<TestCase, 'id'>) => void;
  onClearTestCases: () => void;
  onGenerateFromStory: (storyKey: string) => void;
  onConfigureGeneration?: () => void;
  hasGenerationConfig?: boolean;
  isLoading?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function StoryCard({
  story,
  cases,
  onUpdateTestCase,
  onDeleteTestCase,
  onAddTestCase,
  onClearTestCases,
  onGenerateFromStory,
  onConfigureGeneration,
  hasGenerationConfig = false,
  isLoading = false,
  isExpanded = false,
  onToggleExpanded
}: StoryCardProps) {
  // Debug logging
  console.log('🔍 [StoryCard] Rendering story:', { 
    key: story.key, 
    summary: story.summary,
    description: story.description?.substring(0, 50) + '...',
    hasError: !!(story as any).error 
  });
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = onToggleExpanded ? isExpanded : localExpanded;
  const toggleExpanded = onToggleExpanded || (() => setLocalExpanded(!localExpanded));

  const hasError = (story as any).error;

  return (
    <Card className={`w-full ${hasError ? 'border-red-200 bg-red-50/30' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="h-6 w-6 p-0"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>

            <div className="flex-1">
              {hasError ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-red-700">{story.key}</span>
                    <Badge variant="destructive" className="text-xs">Error</Badge>
                  </div>
                  <p className="text-sm text-red-600 mt-1">{(story as any).error}</p>
                  
                  {/* Show reconnect button for auth errors */}
                  {((story as any).error?.includes("authentication") || 
                    (story as any).error?.includes("Reconnect") || 
                    (story as any).error?.includes("expired")) && (
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-7 text-xs"
                      >
                        <Link href="/dashboard">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reconnect Jira
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    {story.url ? (
                      <a
                        href={story.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline"
                      >
                        <span className="font-mono text-sm font-medium">{story.key}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="font-mono text-sm font-medium">{story.key}</span>
                    )}

                    {story.status && (
                      <Badge variant="secondary" className="text-xs">
                        {story.status}
                      </Badge>
                    )}
                    {story.issueType && (
                      <Badge variant="outline" className="text-xs">
                        {story.issueType}
                      </Badge>
                    )}
                    {story.priority && (
                      <Badge variant="outline" className="text-xs">
                        Priority: {story.priority}
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-medium text-sm mt-1 leading-tight">
                    {story.summary}
                  </h3>

                  <p className="text-sm text-muted-foreground mt-1">
                    Project: {story.projectKey}
                  </p>
                </div>
              )}
            </div>

            {!hasError && (
              <div className="flex items-center gap-2">
                {onConfigureGeneration && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onConfigureGeneration}
                    className="h-8"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                )}
                
                <Button
                  size="sm"
                  onClick={() => onGenerateFromStory(story.key)}
                  disabled={isLoading}
                  className={hasGenerationConfig ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  {isLoading ? "Generating..." : hasGenerationConfig ? "Generate with Settings" : "Generate Tests"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && !hasError && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          
          {/* Story Details */}
          <div className="space-y-3 mb-4">
            {story.assignee && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Assignee: </span>
                <span className="text-sm">{story.assignee.displayName}</span>
              </div>
            )}

            {(story.created || story.updated) && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                {story.created && (
                  <div>
                    <span className="font-medium">Created: </span>
                    <span>{new Date(story.created).toLocaleDateString()}</span>
                  </div>
                )}
                {story.updated && (
                  <div>
                    <span className="font-medium">Updated: </span>
                    <span>{new Date(story.updated).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}

            {story.labels && story.labels.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Labels:</span>
                <div className="flex flex-wrap gap-1">
                  {story.labels.map((label: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {story.components && story.components.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Components:</span>
                <div className="flex flex-wrap gap-1">
                  {story.components.map((component: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {component}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {story.description && (
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Description:</span>
                <div className="text-sm bg-muted/30 p-3 rounded border">
                  {story.description}
                </div>
              </div>
            )}

            {story.acceptanceCriteria && (
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Acceptance Criteria:</span>
                <div className="text-sm bg-muted/30 p-3 rounded border">
                  {story.acceptanceCriteria}
                </div>
              </div>
            )}
          </div>

          {/* Test Cases for this Story */}
          <div>
            <h4 className="text-sm font-medium mb-3">Test Cases ({cases.length})</h4>
            <TestCasesList
              cases={cases}
              onUpdate={onUpdateTestCase}
              onDelete={onDeleteTestCase}
              onAdd={onAddTestCase}
              onClear={onClearTestCases}
              hasStory={true}
              hasGenerationConfig={hasGenerationConfig}
              onGenerateFromStory={() => onGenerateFromStory(story.key)}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}