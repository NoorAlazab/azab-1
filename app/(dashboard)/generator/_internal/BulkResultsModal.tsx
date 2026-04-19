"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { safeStringify } from "@/lib/utils/safeStringify";
import type { BulkPublishResult } from "./types";

/**
 * Modal that summarises a bulk-publish operation.
 *
 * Extracted from generator/page.tsx so the page file stays focused on
 * orchestration. Behavior is identical to the original inline component;
 * only the import paths changed.
 */
export function BulkResultsModal({
  isOpen,
  onClose,
  results,
}: {
  isOpen: boolean;
  onClose: () => void;
  results: BulkPublishResult;
}) {
  if (!isOpen) return null;

  const message =
    results.failures > 0
      ? `Published ${results.successes}/${results.total} stories. ${results.failures} failed.`
      : `Successfully published all ${results.successes} stories.`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Publish Results</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">{message}</p>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.results.map((result) => (
              <div
                key={result.suiteId}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <span className="font-medium">{result.issueKey}</span>
                <div className="flex items-center gap-2">
                  {result.ok ? (
                    <Badge variant="default">Success</Badge>
                  ) : (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                  {result.ok && result.commentUrl && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={result.commentUrl} target="_blank">
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {results.results.some((r) => !r.ok) && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Error Details:</h4>
              {results.results
                .filter((r) => !r.ok)
                .map((result) => (
                  <div key={result.suiteId} className="text-xs">
                    <strong>{result.issueKey}:</strong> {result.message}
                    {result.detail && (
                      <pre className="bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                        {typeof result.detail === "string"
                          ? result.detail
                          : safeStringify(result.detail)}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
