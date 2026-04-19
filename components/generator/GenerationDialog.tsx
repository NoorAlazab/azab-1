import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface GenerationOptions {
  mode: "overwrite" | "append";
  coverage: string[];
  maxCases: number;
}

interface GenerationDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (options: GenerationOptions) => void;
  hasExistingCases: boolean;
  isLoading?: boolean;
}

const coverageOptions = [
  { value: "functional", label: "Functional", description: "Core functionality tests" },
  { value: "negative", label: "Negative", description: "Invalid inputs and error cases" },
  { value: "boundary", label: "Boundary", description: "Edge cases and limits" },
  { value: "accessibility", label: "Accessibility", description: "A11y compliance tests" },
  { value: "security", label: "Security", description: "Security vulnerabilities" },
  { value: "performance", label: "Performance", description: "Load and speed tests" },
];

export function GenerationDialog({ 
  open, 
  onClose, 
  onGenerate, 
  hasExistingCases, 
  isLoading = false 
}: GenerationDialogProps) {
  const [mode, setMode] = useState<"overwrite" | "append">(hasExistingCases ? "append" : "overwrite");
  const [coverage, setCoverage] = useState<string[]>(["functional", "negative", "boundary"]);
  const [maxCases, setMaxCases] = useState(8);
  const [maxCasesError, setMaxCasesError] = useState<string>("");

  const handleCoverageChange = (option: string, checked: boolean) => {
    if (checked) {
      setCoverage(prev => [...prev, option]);
    } else {
      setCoverage(prev => prev.filter(c => c !== option));
    }
  };

  const handleGenerate = () => {
    onGenerate({
      mode,
      coverage,
      maxCases: Math.min(Math.max(maxCases, 3), 20)
    });
  };

  const removeCoverage = (option: string) => {
    setCoverage(prev => prev.filter(c => c !== option));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="max-w-md w-full mx-4">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Test Generation Settings</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure how test cases should be generated. Use &quot;Generate from Story&quot; to apply these settings.
          </p>
        </CardHeader>
        <CardContent>

        <div className="space-y-4">
          {/* Mode Selection */}
          {hasExistingCases && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mode</Label>
              <Select value={mode} onValueChange={(value: any) => setMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overwrite">
                    Overwrite existing cases
                  </SelectItem>
                  <SelectItem value="append">
                    Add to existing cases
                  </SelectItem>
                </SelectContent>
              </Select>
              {mode === "overwrite" && (
                <p className="text-xs text-amber-600">
                  ⚠️ This will replace all existing test cases
                </p>
              )}
            </div>
          )}

          {/* Max Cases */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Maximum Cases</Label>
            <Input
              type="number"
              min={3}
              max={20}
              value={maxCases}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                const clampedValue = Math.min(Math.max(value, 3), 20);
                setMaxCases(clampedValue);
                
                if (value < 3 && value > 0) {
                  setMaxCasesError("Minimum 3 test cases required");
                } else if (value > 20) {
                  setMaxCasesError("Maximum 20 test cases allowed");
                } else {
                  setMaxCasesError("");
                }
              }}
              className={`w-full ${maxCasesError ? "border-red-500 focus:border-red-500" : ""}`}
            />
            {maxCasesError ? (
              <p className="text-xs text-red-500">{maxCasesError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Generate 3-20 test cases (recommended: 8)
              </p>
            )}
          </div>

          {/* Coverage Options */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Coverage Types</Label>
            <div className="grid grid-cols-2 gap-2">
              {coverageOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={option.value}
                    checked={coverage.includes(option.value)}
                    onChange={(e) => 
                      handleCoverageChange(option.value, e.target.checked)
                    }
                    className="h-3 w-3"
                  />
                  <label
                    htmlFor={option.value}
                    className="text-xs font-medium cursor-pointer"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            
            {/* Selected Coverage Tags */}
            {coverage.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {coverage.map((option) => (
                  <Badge key={option} variant="secondary" className="text-xs">
                    {option}
                    <button
                      onClick={() => removeCoverage(option)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            
            {coverage.length === 0 && (
              <p className="text-xs text-amber-600">
                ⚠️ Please select at least one coverage type
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={isLoading || coverage.length === 0}
          >
            {isLoading ? "Saving..." : `Save Configuration`}
          </Button>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}