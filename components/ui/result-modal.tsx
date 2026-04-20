"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { toDisplayDetail } from "@/lib/shared/utils/safeStringify";

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "comment" | "subtasks";
  message: string;
  storyUrl?: string;
  commentUrl?: string;
  created?: Array<{ key: string; url?: string }>;
  detail?: any;
}

export function ResultModal({
  isOpen,
  onClose,
  mode,
  message,
  storyUrl,
  commentUrl,
  created,
  detail
}: ResultModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {mode === 'subtasks' ? 'Sub-tasks Created' : mode === 'comment' ? 'Published to Jira' : 'Details'}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              ✕
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {message}
          </p>
          
          {mode === 'subtasks' && created && created.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Created Sub-tasks:</h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {created.map((subtask) => (
                  <div key={subtask.key} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                    <span className="font-mono">{subtask.key}</span>
                    {subtask.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-6 px-2"
                      >
                        <a 
                          href={subtask.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const text = toDisplayDetail(detail);
            return text ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Details:</h4>
                <pre className="text-xs bg-gray-100 p-2 rounded max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                  {text}
                </pre>
              </div>
            ) : null;
          })()}
          
          <div className="flex justify-between gap-2">
            {storyUrl && (
              <Button variant="outline" asChild>
                <a 
                  href={commentUrl || storyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Issue
                </a>
              </Button>
            )}
            <Button onClick={onClose} className="ml-auto">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}