"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Wand2, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  MessageSquare,
  ListTodo,
  RotateCcw
} from "lucide-react";
import { fetchWithCsrf } from "@/lib/client/csrf";
import type { 
  JiraStoryDetails, 
  TestCase, 
  WriteMode, 
  DraftResponse, 
  DraftPayload,
  PublishResponse 
} from "@/lib/generator/types";

interface PublishSummaryProps {
  story?: JiraStoryDetails;
  cases: TestCase[];
  writeMode: WriteMode;
  onWriteModeChange: (mode: WriteMode) => void;
  onDraftGenerated: (draft: DraftResponse) => void;
  hasDraft: boolean;
  onResetToDraft: () => void;
}

interface DraftMutationVariables {
  payload: DraftPayload;
}

interface PublishMutationVariables {
  issueKey: string;
  cases: TestCase[];
  writeMode: WriteMode;
}

const draftTestCases = async ({ payload }: DraftMutationVariables): Promise<DraftResponse> => {
  const response = await fetchWithCsrf("/api/generator/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Draft failed: ${error}`);
  }

  return response.json();
};

const publishTestCases = async ({ 
  issueKey, 
  cases, 
  writeMode 
}: PublishMutationVariables): Promise<PublishResponse> => {
  const response = await fetchWithCsrf("/api/generator/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      issueKey,
      cases,
      writeMode,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Publish failed: ${error}`);
  }

  return response.json();
};

export function PublishSummary({
  story,
  cases,
  writeMode,
  onWriteModeChange,
  onDraftGenerated,
  hasDraft,
  onResetToDraft,
}: PublishSummaryProps) {
  const [publishSuccess, setPublishSuccess] = useState<PublishResponse | null>(null);

  const draftMutation = useMutation({
    mutationFn: draftTestCases,
    onSuccess: (data) => {
      onDraftGenerated(data);
      setPublishSuccess(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: publishTestCases,
    onSuccess: (data) => {
      setPublishSuccess(data);
    },
  });

  const handleDraft = async () => {
    if (!story) return;

    const payload: DraftPayload = {
      issueKey: story.key,
      nCases: 10,
      temperature: 0.2,
    };

    draftMutation.mutate({ payload });
  };

  const handlePublish = async () => {
    if (!story || cases.length === 0) return;

    publishMutation.mutate({
      issueKey: story.key,
      cases,
      writeMode,
    });
  };

  const canDraft = story && !draftMutation.isPending;
  const canPublish = story && cases.length > 0 && !publishMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Write Mode Selection */}
      <div className="space-y-2">
        <Label>Write Mode</Label>
        <Select value={writeMode} onValueChange={onWriteModeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comment">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <div>
                  <div>Comment</div>
                  <div className="text-xs text-muted-foreground">
                    Add test cases as a comment
                  </div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="subtasks">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                <div>
                  <div>Sub-tasks</div>
                  <div className="text-xs text-muted-foreground">
                    Create individual sub-tasks
                  </div>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Draft Button */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">Generate Test Cases</Label>
            <p className="text-sm text-muted-foreground">
              AI-powered test case generation from story context
            </p>
          </div>
          {hasDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetToDraft}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>

        <Button
          onClick={handleDraft}
          disabled={!canDraft}
          className="w-full gap-2"
        >
          {draftMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              Generate Test Cases
            </>
          )}
        </Button>

        {draftMutation.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {draftMutation.error.message}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Publish Section */}
      {cases.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <div>
            <Label className="text-base font-medium">Publish to Jira</Label>
            <p className="text-sm text-muted-foreground">
              Write test cases to {story?.key} as {writeMode === "comment" ? "a comment" : "sub-tasks"}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">
              {cases.length} test case{cases.length !== 1 ? "s" : ""}
            </Badge>
            <span>•</span>
            <span>
              {cases.reduce((sum, c) => sum + c.steps.length, 0)} total steps
            </span>
          </div>

          <Button
            onClick={handlePublish}
            disabled={!canPublish}
            className="w-full gap-2"
            variant="default"
          >
            {publishMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                Publish to Jira
              </>
            )}
          </Button>

          {publishMutation.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {publishMutation.error.message}
              </AlertDescription>
            </Alert>
          )}

          {publishSuccess && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Successfully published!</p>
                  <div className="text-sm">
                    {publishSuccess.mode === "comment" && publishSuccess.commentId && (
                      <p>Added comment with {publishSuccess.metadata.totalCases} test cases</p>
                    )}
                    {publishSuccess.mode === "subtasks" && publishSuccess.created && (
                      <p>
                        Created {publishSuccess.created.length} sub-tasks: {" "}
                        {publishSuccess.created.map(t => t.key).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}