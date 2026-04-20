"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wand2, Save, Send } from "lucide-react";
import { TestCaseCard } from "@/components/features/generator/TestCaseCard";
import { useToast } from "@/hooks/use-toast";
import type { TestCase } from "@/lib/server/generator/types";
import type { StoryItem, TestCaseDTO } from "./types";
import { timeAgo } from "./utils";

/**
 * Per-story card on the Generator dashboard.
 *
 * Lifted out of generator/page.tsx so the page file shrinks and this
 * surface can be tweaked without scrolling past 900 lines of orchestration
 * code. No behavior change — same props, same JSX.
 */
export function StoryItemCard({
  item,
  onSave,
  onPublish,
  onAddTestCases,
  onUpdate,
  disabled,
}: {
  item: StoryItem;
  onSave: () => void;
  onPublish: () => void;
  onAddTestCases: () => void;
  onUpdate: (updates: Partial<StoryItem>) => void;
  disabled: boolean;
}) {
  const { toast } = useToast();

  const handleCaseEdit = (caseIndex: number, updates: Partial<TestCaseDTO>) => {
    const newCases = [...item.cases];
    newCases[caseIndex] = { ...newCases[caseIndex], ...updates };
    onUpdate({ cases: newCases, dirty: true });
  };

  const handleCaseDelete = (caseIndex: number) => {
    if (item.cases.length <= 3) {
      toast({
        title: "Cannot delete test case",
        description: "A minimum of 3 test cases is required.",
        variant: "destructive",
      });
      return;
    }
    const newCases = item.cases.filter((_, i) => i !== caseIndex);
    onUpdate({ cases: newCases, dirty: true });
  };

  const statusColor =
    item.lastResult?.ok === false
      ? "destructive"
      : item.cases.length === 0
        ? "secondary"
        : "default";
  const statusText =
    item.lastResult?.ok === false
      ? "Failed"
      : item.cases.length === 0
        ? "Empty"
        : "Ready";

  return (
    <Card className="rounded-2xl shadow-sm border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Link
                href={item.story.url || "#"}
                target="_blank"
                className="hover:underline"
              >
                {item.issueKey}
              </Link>
              <Badge variant={statusColor}>{statusText}</Badge>
              {item.dirty && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  Unsaved changes
                </Badge>
              )}
              {!item.dirty && item.lastSavedAt && (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  Saved • {timeAgo(item.lastSavedAt)}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {item.story.summary}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {item.cases.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Test Cases ({item.cases.length})
            </Label>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {item.cases.map((testCase, index) => (
                <TestCaseCard
                  key={testCase.id || index}
                  testCase={testCase}
                  index={index}
                  onUpdate={(_id: string, updates: Partial<TestCase>) =>
                    handleCaseEdit(index, updates)
                  }
                  onDelete={(_id: string) => handleCaseDelete(index)}
                  onDuplicate={(tc: TestCase) => {
                    const newCase = { ...tc, id: undefined };
                    const newCases = [...item.cases, newCase];
                    onUpdate({ cases: newCases, dirty: true });
                  }}
                  canDelete={item.cases.length > 3}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAddTestCases}
              disabled={disabled || !item.suiteId}
              className="gap-1"
            >
              <Wand2 className="h-3 w-3" />
              Add Test Cases
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onSave}
              disabled={
                disabled || !item.suiteId || item.cases.length === 0 || item.saving
              }
              className="gap-1"
            >
              <Save className="h-3 w-3" />
              {item.saving ? "Saving..." : "Save"}
            </Button>
          </div>

          <Select
            value={item.publishMode}
            onValueChange={(value: "comment" | "subtasks") =>
              onUpdate({ publishMode: value })
            }
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comment">Comment</SelectItem>
              <SelectItem value="subtasks">Subtasks</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={onPublish}
            disabled={
              disabled ||
              !item.suiteId ||
              item.cases.length === 0 ||
              item.publishing
            }
            className="gap-1"
          >
            <Send className="h-3 w-3" />
            {item.publishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
