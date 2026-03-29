"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Settings2, RefreshCw, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { fetchWithCsrf } from "@/lib/client/csrf";
import type { ExplorationConfig, ExplorationMode, ExplorationRole } from "@/lib/exploration/types";
import type { StoryAnalysisResult } from "@/components/exploration/SourcePicker";

interface RunConfigCardProps {
  onStartExploration: (config: ExplorationConfig) => void;
  storyAnalysis?: StoryAnalysisResult | null;
  disabled?: boolean;
  loading?: boolean;
}

export function RunConfigCard({
  onStartExploration,
  storyAnalysis,
  disabled = false,
  loading = false
}: RunConfigCardProps) {
  const [config, setConfig] = useState<ExplorationConfig>({
    envUrl: "https://",
    role: "recruiter",
    mode: "guided",
    timeBudgetMins: 5,
    maxSteps: 50,
  });

  const [isLoadingLastUsed, setIsLoadingLastUsed] = useState(true);
  const [showTestPlan, setShowTestPlan] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<keyof ExplorationConfig, string>>>({});

  // Fetch last used environment URL on component mount
  useEffect(() => {
    const fetchLastUsedUrl = async () => {
      try {
        const response = await fetch("/api/user/last-used-env-url", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (data.envUrl) {
            setConfig(prev => ({
              ...prev,
              envUrl: data.envUrl,
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch last used URL:", error);
      } finally {
        setIsLoadingLastUsed(false);
      }
    };

    fetchLastUsedUrl();
  }, []);

  // Update env URL when story analysis is available
  useEffect(() => {
    if (storyAnalysis?.envUrl) {
      const extractedUrl = storyAnalysis.envUrl;
      setConfig(prev => ({
        ...prev,
        envUrl: extractedUrl,
      }));
    }
  }, [storyAnalysis?.envUrl]);

  const validateConfig = (): boolean => {
    const newErrors: Partial<Record<keyof ExplorationConfig, string>> = {};

    // Validate URL
    try {
      const url = new URL(config.envUrl);
      if (!url.protocol.startsWith('http')) {
        newErrors.envUrl = "URL must use http or https protocol";
      }
    } catch {
      newErrors.envUrl = "Please enter a valid URL";
    }

    // Validate time budget
    if (config.timeBudgetMins < 1 || config.timeBudgetMins > 60) {
      newErrors.timeBudgetMins = "Time budget must be between 1 and 60 minutes";
    }

    // Validate max steps
    if (config.maxSteps < 1 || config.maxSteps > 500) {
      newErrors.maxSteps = "Max steps must be between 1 and 500";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStartClick = async () => {
    if (validateConfig()) {
      // Save the current environment URL as last used
      try {
        await fetchWithCsrf("/api/user/last-used-env-url", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ envUrl: config.envUrl }),
        });
      } catch (error) {
        console.error("Failed to save last used URL:", error);
      }

      onStartExploration(config);
    }
  };

  const updateConfig = (field: keyof ExplorationConfig, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center text-base font-medium">
          <Settings2 className="h-4 w-4 mr-2" />
          Run Configuration
        </CardTitle>
        <CardDescription>
          Configure the exploration environment and parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="env-url">Environment URL</Label>
            {storyAnalysis?.envUrl && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Auto-filled from story
              </span>
            )}
          </div>
          <Input
            id="env-url"
            placeholder="https://staging.example.com"
            value={config.envUrl}
            onChange={(e) => updateConfig('envUrl', e.target.value)}
            disabled={disabled}
            className={errors.envUrl ? 'border-red-500' : ''}
          />
          {errors.envUrl && (
            <p className="text-xs text-red-600">{errors.envUrl}</p>
          )}
          <p className="text-xs text-muted-foreground">
            The target environment to explore
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select 
            value={config.role} 
            onValueChange={(value: string) => updateConfig('role', value as ExplorationRole)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recruiter">Recruiter - Standard user permissions</SelectItem>
              <SelectItem value="hiring_manager">Hiring Manager - Manager-level access</SelectItem>
              <SelectItem value="admin">Admin - Full system access</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The role to test as (ephemeral user will be created)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="exploration-mode">Exploration Mode</Label>
          <Select 
            value={config.mode} 
            onValueChange={(value: string) => updateConfig('mode', value as ExplorationMode)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="guided">Guided - Follow structured patterns</SelectItem>
              <SelectItem value="freeform">Freeform - Open exploration</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How the exploration should be conducted
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="time-budget">Time Budget (minutes)</Label>
            <Input
              id="time-budget"
              type="number"
              min="1"
              max="60"
              value={config.timeBudgetMins}
              onChange={(e) => updateConfig('timeBudgetMins', parseInt(e.target.value) || 1)}
              disabled={disabled}
              className={errors.timeBudgetMins ? 'border-red-500' : ''}
            />
            {errors.timeBudgetMins && (
              <p className="text-xs text-red-600">{errors.timeBudgetMins}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-steps">Max Steps</Label>
            <Input
              id="max-steps"
              type="number"
              min="1"
              max="500"
              value={config.maxSteps}
              onChange={(e) => updateConfig('maxSteps', parseInt(e.target.value) || 1)}
              disabled={disabled}
              className={errors.maxSteps ? 'border-red-500' : ''}
            />
            {errors.maxSteps && (
              <p className="text-xs text-red-600">{errors.maxSteps}</p>
            )}
          </div>
        </div>

        {storyAnalysis && storyAnalysis.testScenarios.length > 0 && (
          <div className="border rounded-lg p-4 space-y-2">
            <button
              type="button"
              onClick={() => setShowTestPlan(!showTestPlan)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Test Plan ({storyAnalysis.testScenarios.length} scenarios)</span>
              </div>
              {showTestPlan ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showTestPlan && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Extracted from acceptance criteria:
                </p>
                <ul className="space-y-1.5 text-sm">
                  {storyAnalysis.testScenarios.map((scenario, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-muted-foreground">{scenario}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleStartClick}
          disabled={disabled || loading || isLoadingLastUsed || !config.envUrl.startsWith('http')}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Starting Exploration...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start Exploration
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}