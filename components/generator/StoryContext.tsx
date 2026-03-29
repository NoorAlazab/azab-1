"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  User,
  Calendar
} from "lucide-react";
import type { JiraStoryDetails } from "@/lib/generator/types";

interface StoryContextProps {
  story?: JiraStoryDetails;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const getStatusColor = (status: string): string => {
  const normalizedStatus = status.toLowerCase();
  
  if (normalizedStatus.includes('done') || normalizedStatus.includes('closed') || normalizedStatus.includes('resolved')) {
    return "bg-green-500";
  }
  if (normalizedStatus.includes('progress') || normalizedStatus.includes('review')) {
    return "bg-blue-500";
  }
  if (normalizedStatus.includes('todo') || normalizedStatus.includes('open') || normalizedStatus.includes('backlog')) {
    return "bg-gray-500";
  }
  return "bg-yellow-500";
};

const getStatusIcon = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  
  if (normalizedStatus.includes('done') || normalizedStatus.includes('closed') || normalizedStatus.includes('resolved')) {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  if (normalizedStatus.includes('progress') || normalizedStatus.includes('review')) {
    return <Clock className="h-4 w-4" />;
  }
  return <AlertCircle className="h-4 w-4" />;
};

export function StoryContext({ story, isLoading, error, onRetry }: StoryContextProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Story Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Loading story details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Story Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load story: {error.message}</span>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!story) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Story Context
          </CardTitle>
          <CardDescription>
            Fetch a Jira story to view its details here
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Story Context
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          {story.url && (
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {story.key}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {!story.url && (
            <span className="font-mono text-sm">{story.key}</span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Story Header */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="flex items-center gap-1">
              {getStatusIcon(story.status)}
              {story.status}
            </Badge>
            <Badge variant="secondary">
              {story.issueType}
            </Badge>
            {story.priority && (
              <Badge variant="outline">
                Priority: {story.priority}
              </Badge>
            )}
          </div>

          <h3 className="font-semibold text-lg leading-tight">
            {story.summary}
          </h3>
        </div>

        <Separator />

        {/* Story Details */}
        <div className="space-y-4">
          {/* Assignee & Reporter */}
          {(story.assignee || story.reporter) && (
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {story.assignee && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>Assignee: {story.assignee.displayName}</span>
                </div>
              )}
              {story.reporter && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>Reporter: {story.reporter.displayName}</span>
                </div>
              )}
            </div>
          )}

          {/* Dates */}
          {(story.created || story.updated) && (
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {story.created && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Created: {new Date(story.created).toLocaleDateString()}</span>
                </div>
              )}
              {story.updated && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Updated: {new Date(story.updated).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {story.description && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
                {story.description}
              </div>
            </div>
          )}

          {/* Acceptance Criteria */}
          {story.acceptanceCriteria && (
            <div>
              <h4 className="font-medium mb-2">Acceptance Criteria</h4>
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
                {story.acceptanceCriteria}
              </div>
            </div>
          )}

          {/* Labels */}
          {story.labels && story.labels.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Labels</h4>
              <div className="flex flex-wrap gap-2">
                {story.labels.map((label, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Components */}
          {story.components && story.components.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Components</h4>
              <div className="flex flex-wrap gap-2">
                {story.components.map((component, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {component}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}