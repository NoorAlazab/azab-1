"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, RefreshCw } from "lucide-react";

interface StoryFetcherProps {
  initialIssueKey?: string;
  onSubmit: (issueKey: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function StoryFetcher({ 
  initialIssueKey = "", 
  onSubmit, 
  isLoading = false,
  disabled = false
}: StoryFetcherProps) {
  const [input, setInput] = useState(initialIssueKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim().toUpperCase();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  const isValidFormat = (key: string) => {
    // Basic Jira key format validation: ABC-123
    return /^[A-Z][A-Z0-9]*-\d+$/.test(key);
  };

  const trimmed = input.trim().toUpperCase();
  const isValid = trimmed && isValidFormat(trimmed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-lg font-semibold">
          <Search className="h-4 w-4" aria-hidden="true" />
          Fetch Jira Story
        </CardTitle>
        <CardDescription>
          Enter a Jira issue key (e.g., ABC-123) to fetch story details and generate test cases
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="issueKey">Issue Key</Label>
            <Input
              id="issueKey"
              type="text"
              placeholder={disabled ? "Select a Jira site first" : "e.g., ABC-123"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={
                input && !isValidFormat(trimmed)
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }
              disabled={isLoading || disabled}
            />
            {input && !isValidFormat(trimmed) && (
              <p className="text-sm text-destructive">
                Invalid format. Expected format: ABC-123
              </p>
            )}
          </div>
          
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={!isValid || isLoading || disabled}
              className="min-w-[100px] gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Fetching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Fetch
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}