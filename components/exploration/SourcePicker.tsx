"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, FileText, ExternalLink, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { validateJiraStoryKey, formatFileSize } from "@/lib/exploration/service";
import { validatePdfFile } from "@/lib/exploration/validators";
import { fetchWithCsrf } from "@/lib/client/csrf";
import type { ExplorationSource } from "@/lib/exploration/types";

export interface StoryAnalysisResult {
  envUrl: string | null;
  auth: {
    username: string | null;
    password: string | null;
  } | null;
  testScenarios: string[];
  rawStory: {
    key: string;
    summary: string;
    description: string;
    acceptanceCriteria: string;
  };
}

interface SourcePickerProps {
  selectedSource?: ExplorationSource | null;
  onSourceChange: (source: ExplorationSource | null) => void;
  onStoryAnalyzed?: (analysis: StoryAnalysisResult | null) => void;
  disabled?: boolean;
}

export function SourcePicker({ selectedSource, onSourceChange, onStoryAnalyzed, disabled = false }: SourcePickerProps) {
  const [activeTab, setActiveTab] = useState<"story" | "pdf">("story");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAnalyzingStory, setIsAnalyzingStory] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [storyKeyInput, setStoryKeyInput] = useState("");

  const currentStoryKey = selectedSource?.type === "story" ? selectedSource.key : "";
  const currentFile = selectedSource?.type === "pdf" ? selectedSource : null;

  const analyzeStory = async (storyKey: string) => {
    setIsAnalyzingStory(true);
    setAnalysisError(null);
    setAnalysisSuccess(false);

    try {
      const response = await fetchWithCsrf("/api/exploration/analyze-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ storyKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze story");
      }

      const analysis: StoryAnalysisResult = await response.json();
      if (onStoryAnalyzed) {
        onStoryAnalyzed(analysis);
      }
      setAnalysisSuccess(true);
    } catch (error) {
      console.error("Story analysis error:", error);
      setAnalysisError(error instanceof Error ? error.message : "Failed to analyze story");
      if (onStoryAnalyzed) {
        onStoryAnalyzed(null);
      }
    } finally {
      setIsAnalyzingStory(false);
    }
  };

  const handleStoryKeyChange = (value: string) => {
    setStoryKeyInput(value.toUpperCase());
    setAnalysisSuccess(false);
    setAnalysisError(null);
  };

  const handleAnalyzeClick = () => {
    const trimmedKey = storyKeyInput.trim();

    if (!trimmedKey) {
      setAnalysisError("Please enter a story key");
      return;
    }

    if (!validateJiraStoryKey(trimmedKey)) {
      setAnalysisError("Invalid story key format. Use PROJECT-123 format (e.g., ABC-123)");
      return;
    }

    onSourceChange({
      type: "story",
      key: trimmedKey,
    });

    analyzeStory(trimmedKey);
  };

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    
    // Validate file
    const validation = validatePdfFile(file);
    if (!validation.valid) {
      setUploadError(validation.error!);
      return;
    }

    setIsUploading(true);

    try {
      // Upload file
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetchWithCsrf("/api/exploration/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      
      onSourceChange({
        type: "pdf",
        fileId: result.fileId,
        filename: file.name,
        size: file.size,
        file: file,
      });
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearFile = () => {
    setUploadError(null);
    onSourceChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTabChange = (value: string) => {
    const tab = value as "story" | "pdf";
    setActiveTab(tab);

    // Clear current source when switching tabs
    onSourceChange(null);
    setUploadError(null);
    setStoryKeyInput("");
    setAnalysisSuccess(false);
    setAnalysisError(null);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base font-medium">Source Selection</CardTitle>
        <CardDescription>
          Choose what to explore: a Jira story or upload a PDF manual
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="story" disabled={disabled}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Jira Story
            </TabsTrigger>
            <TabsTrigger value="pdf" disabled={disabled}>
              <FileText className="h-4 w-4 mr-2" />
              PDF Manual
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="story" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="story-key">Story Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="story-key"
                    placeholder="e.g., ABC-123"
                    value={storyKeyInput}
                    onChange={(e) => handleStoryKeyChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !disabled && !isAnalyzingStory && storyKeyInput) {
                        e.preventDefault();
                        handleAnalyzeClick();
                      }
                    }}
                    disabled={disabled || isAnalyzingStory}
                    className="uppercase pr-10"
                  />
                  {isAnalyzingStory && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!isAnalyzingStory && analysisSuccess && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                  {!isAnalyzingStory && analysisError && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleAnalyzeClick}
                  disabled={disabled || isAnalyzingStory || !storyKeyInput}
                  className="shrink-0"
                >
                  {isAnalyzingStory ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Analyse Story"
                  )}
                </Button>
              </div>
              {isAnalyzingStory && (
                <p className="text-xs text-muted-foreground">
                  Fetching story from Jira and extracting test scenarios...
                </p>
              )}
              {!isAnalyzingStory && analysisSuccess && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Story analyzed successfully
                </p>
              )}
              {!isAnalyzingStory && analysisError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {analysisError}
                </p>
              )}
              {!isAnalyzingStory && !analysisSuccess && !analysisError && (
                <p className="text-xs text-muted-foreground">
                  Format: PROJECT-123 (e.g., HIRE-456, DEV-789)
                </p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="pdf" className="space-y-4 mt-4">
            {!currentFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  disabled 
                    ? 'border-muted bg-muted/20 cursor-not-allowed' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer'
                }`}
                onDrop={disabled ? undefined : handleDrop}
                onDragOver={disabled ? undefined : handleDragOver}
                onClick={disabled ? undefined : () => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {isUploading ? "Uploading..." : "Drop PDF file here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum size: 10MB
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                  disabled={disabled || isUploading}
                />
              </div>
            ) : (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">{currentFile.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(currentFile.size)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearFile}
                    disabled={disabled}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
            
            {uploadError && (
              <p className="text-sm text-red-600">{uploadError}</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}