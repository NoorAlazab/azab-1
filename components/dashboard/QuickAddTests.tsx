"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wand2, ArrowRight } from "lucide-react";

export function QuickAddTests() {
  const [issueKey, setIssueKey] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = issueKey.trim().toUpperCase();
    if (trimmed && isValidIssueKey(trimmed)) {
      router.push(`/generator?issueKey=${encodeURIComponent(trimmed)}`);
    }
  };

  const isValidIssueKey = (key: string) => {
    // Basic Jira key format validation: ABC-123
    return /^[A-Z][A-Z0-9]*-\d+$/.test(key);
  };

  const trimmed = issueKey.trim().toUpperCase();
  const isValid = trimmed && isValidIssueKey(trimmed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          Quick Test Generation
        </CardTitle>
        <CardDescription>
          Generate test cases from a Jira story in seconds
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="issueKey">Jira Issue Key</Label>
            <Input
              id="issueKey"
              value={issueKey}
              onChange={(e) => setIssueKey(e.target.value)}
              placeholder="e.g., ABC-123"
              className="font-mono"
            />
            {trimmed && !isValid && (
              <p className="text-sm text-destructive">
                Invalid format. Use PROJECT-NUMBER (e.g., ABC-123)
              </p>
            )}
          </div>
          
          <Button 
            type="submit" 
            disabled={!isValid}
            className="w-full"
          >
            Generate Test Cases
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Enter any Jira issue key to automatically fetch story details and generate comprehensive test cases.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}