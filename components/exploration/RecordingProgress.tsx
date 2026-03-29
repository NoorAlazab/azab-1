/**
 * Recording Progress Component
 * Shows visual feedback while selectors are being recorded
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import type { RecordingProgress } from "@/types/environment";

interface RecordingProgressProps {
  pages: RecordingProgress[];
  totalPages: number;
}

export function RecordingProgressComponent({ pages, totalPages }: RecordingProgressProps) {
  const completedCount = pages.filter(p => p.status === 'completed').length;
  const failedCount = pages.filter(p => p.status === 'failed').length;
  const progressPercentage = (completedCount / totalPages) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Recording Element Selectors
        </CardTitle>
        <CardDescription>
          Learning your website's interface for accurate testing...
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Progress: {completedCount} / {totalPages} pages
            </span>
            <span className="font-medium">{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Individual page status */}
        <div className="space-y-2">
          {pages.map((page, index) => (
            <div
              key={page.page}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              {/* Status icon */}
              {page.status === 'completed' && (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
              {page.status === 'recording' && (
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
              )}
              {page.status === 'failed' && (
                <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
              )}
              {page.status === 'pending' && (
                <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}

              {/* Page info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize truncate">
                  {page.page}
                </p>
                {page.status === 'completed' && page.elementCount !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {page.elementCount} elements recorded
                  </p>
                )}
                {page.status === 'recording' && (
                  <p className="text-xs text-muted-foreground">
                    Recording...
                  </p>
                )}
                {page.status === 'failed' && page.error && (
                  <p className="text-xs text-red-600 truncate">
                    {page.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary footer */}
        {failedCount > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm text-amber-600">
              {failedCount} page{failedCount > 1 ? 's' : ''} failed to record. Tests will use fallback strategies for these pages.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
