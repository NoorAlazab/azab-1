"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SourcePicker, type StoryAnalysisResult } from "@/components/exploration/SourcePicker";
import { RunConfigCard } from "@/components/exploration/RunConfigCard";
import { RunsTable } from "@/components/exploration/RunsTable";
import { EmptyState } from "@/components/exploration/EmptyState";
import { Beaker, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithCsrf } from "@/lib/client/csrf";
import type { ExplorationSource, ExplorationConfig } from "@/lib/exploration/types";

const fetchRuns = async () => {
  const response = await fetch("/api/exploration/runs", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch runs");
  }

  const data = await response.json();
  return data.runs;
};

export default function ExplorationPage() {
  const [selectedSource, setSelectedSource] = useState<ExplorationSource | null>(null);
  const [storyAnalysis, setStoryAnalysis] = useState<StoryAnalysisResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["exploration-runs"],
    queryFn: fetchRuns,
  });

  const handleStartExploration = async (config: ExplorationConfig) => {
    if (!selectedSource) return;
    
    setIsSubmitting(true);
    
    try {
      let fileId: string | null = null;
      
      // Upload file if it's a PDF source
      if (selectedSource.type === "pdf" && selectedSource.file) {
        const formData = new FormData();
        formData.append("file", selectedSource.file);
        
        const uploadResponse = await fetchWithCsrf("/api/exploration/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file");
        }
        
        const uploadData = await uploadResponse.json();
        fileId = uploadData.fileId;
      }
      
      // Start exploration
      const explorationBody = {
        source: selectedSource.type === "story" 
          ? { type: "story", key: selectedSource.key }
          : { type: "pdf", fileId: fileId! },
        config,
      };
      
      const response = await fetchWithCsrf("/api/exploration/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(explorationBody),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start exploration");
      }
      
      // Reset form
      setSelectedSource(null);
      
    } catch (error) {
      console.error("Error starting exploration:", error);
      // TODO: Show error toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Beaker className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Exploration</h1>
            <Badge variant="secondary" className="ml-2">
              <Zap className="h-3 w-3 mr-1" />
              Beta
            </Badge>
          </div>
        </div>
        
        <p className="text-muted-foreground">
          Automated bug hunting and exploration using AI-powered browser automation.
          Analyze Jira stories or PDF documentation to identify potential issues.
        </p>
      </div>

      <Separator />

      {/* New Exploration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Start New Exploration</CardTitle>
          <CardDescription>
            Configure and launch an automated exploration session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SourcePicker
            selectedSource={selectedSource}
            onSourceChange={setSelectedSource}
            onStoryAnalyzed={setStoryAnalysis}
            disabled={isSubmitting}
          />

          <RunConfigCard
            disabled={isSubmitting}
            onStartExploration={handleStartExploration}
            storyAnalysis={storyAnalysis}
          />
        </CardContent>
      </Card>

      {/* Runs Section */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : runs.length === 0 ? (
        <EmptyState />
      ) : (
        <RunsTable />
      )}
    </div>
  );
}