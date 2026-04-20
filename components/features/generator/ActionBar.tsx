"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RefreshCw, Wand2, Send, ChevronDown, MessageSquare, List, Save } from "lucide-react";

interface ActionBarProps {
  onFetch: () => void;
  onAddTestCases: () => void;
  onSave: () => void;
  onPublish: (mode: 'comment' | 'subtasks') => void;
  isLoading?: boolean;
  canAddTestCases?: boolean;
  canSave?: boolean;
  canPublish?: boolean;
}

export function ActionBar({
  onFetch,
  onAddTestCases,
  onSave,
  onPublish,
  isLoading = false,
  canAddTestCases = false,
  canSave = false,
  canPublish = false,
}: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold">Test Case Generator</h1>
        <p className="text-sm text-muted-foreground">
          Generate and publish test cases to Jira.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={onFetch}
          disabled={isLoading}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Fetch
        </Button>
        <Button
          variant="outline"
          className="gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={onAddTestCases}
          disabled={!canAddTestCases || isLoading}
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          Add Test Cases
        </Button>
        <Button
          variant="secondary"
          className="gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={onSave}
          disabled={!canSave || isLoading}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Save
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={!canPublish || isLoading}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Publish
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPublish('comment')}>
              <MessageSquare className="h-4 w-4 mr-2" aria-hidden="true" />
              As Comment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPublish('subtasks')}>
              <List className="h-4 w-4 mr-2" aria-hidden="true" />
              As Subtasks
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}