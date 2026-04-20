"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Edit3, 
  Save, 
  X,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import type { TestCase, TestStep, TestPriority, TestType } from "@/lib/server/generator/types";

interface TestCaseEditorProps {
  cases: TestCase[];
  onChange: (cases: TestCase[]) => void;
}

interface TestStepEditorProps {
  step: TestStep;
  stepIndex: number;
  onStepChange: (step: TestStep) => void;
  onRemoveStep: () => void;
}

function TestStepEditor({ step, stepIndex, onStepChange, onRemoveStep }: TestStepEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 h-auto p-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">Step {stepIndex + 1}</span>
        </Button>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemoveStep}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 pl-6">
          <div>
            <Label>Action</Label>
            <Textarea
              value={step.action}
              onChange={(e) => onStepChange({ ...step, action: e.target.value })}
              placeholder="Describe the action to perform..."
              className="min-h-[60px]"
            />
          </div>
          
          <div>
            <Label>Expected Result</Label>
            <Textarea
              value={step.expected}
              onChange={(e) => onStepChange({ ...step, expected: e.target.value })}
              placeholder="Describe the expected outcome..."
              className="min-h-[60px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface TestCaseCardProps {
  testCase: TestCase;
  caseIndex: number;
  onCaseChange: (testCase: TestCase) => void;
  onRemoveCase: () => void;
}

function TestCaseCard({ testCase, caseIndex, onCaseChange, onRemoveCase }: TestCaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(caseIndex === 0);

  const addStep = () => {
    const newStep: TestStep = {
      action: "",
      expected: ""
    };
    onCaseChange({
      ...testCase,
      steps: [...testCase.steps, newStep]
    });
  };

  const updateStep = (stepIndex: number, step: TestStep) => {
    const updatedSteps = [...testCase.steps];
    updatedSteps[stepIndex] = step;
    onCaseChange({
      ...testCase,
      steps: updatedSteps
    });
  };

  const removeStep = (stepIndex: number) => {
    const updatedSteps = testCase.steps.filter((_, i) => i !== stepIndex);
    onCaseChange({
      ...testCase,
      steps: updatedSteps
    });
  };

  const updateTags = (tagsString: string) => {
    const tags = tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    onCaseChange({
      ...testCase,
      tags
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 h-auto p-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <CardTitle className="text-base">
              Test Case {caseIndex + 1}
            </CardTitle>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemoveCase}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        
        {!isExpanded && (
          <CardDescription className="line-clamp-2">
            {testCase.title || "Untitled test case"}
          </CardDescription>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Title</Label>
              <Input
                value={testCase.title}
                onChange={(e) => onCaseChange({ ...testCase, title: e.target.value })}
                placeholder="Test case title..."
              />
            </div>
            
            <div>
              <Label>Priority</Label>
              <Select
                value={testCase.priority}
                onValueChange={(value: TestPriority) => onCaseChange({ ...testCase, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P3">Low</SelectItem>
                  <SelectItem value="P2">Medium</SelectItem>
                  <SelectItem value="P1">High</SelectItem>
                  <SelectItem value="P0">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select
                value={testCase.type}
                onValueChange={(value: TestType) => onCaseChange({ ...testCase, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="functional">Functional</SelectItem>
                  <SelectItem value="smoke">Smoke</SelectItem>
                  <SelectItem value="regression">Regression</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="e2e">End-to-End</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={testCase.tags?.join(', ') || ''}
                onChange={(e) => updateTags(e.target.value)}
                placeholder="ui, api, critical..."
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={testCase.description || ''}
              onChange={(e) => onCaseChange({ ...testCase, description: e.target.value })}
              placeholder="Brief description of what this test case covers..."
              className="min-h-[80px]"
            />
          </div>

          {/* Preconditions */}
          <div>
            <Label>Preconditions (one per line)</Label>
            <Textarea
              value={testCase.preconditions?.join('\n') || ''}
              onChange={(e) => {
                const preconditions = e.target.value
                  .split('\n')
                  .map(line => line.trim())
                  .filter(line => line.length > 0);
                onCaseChange({
                  ...testCase,
                  preconditions: preconditions.length > 0 ? preconditions : undefined
                });
              }}
              placeholder="User is logged in&#10;Database is in clean state&#10;Feature flag is enabled..."
              className="min-h-[80px]"
            />
          </div>

          <Separator />

          {/* Test Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-medium">Test Steps</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStep}
                className="gap-2"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Step
              </Button>
            </div>
            
            <div className="space-y-3">
              {testCase.steps.map((step, stepIndex) => (
                <TestStepEditor
                  key={stepIndex}
                  step={step}
                  stepIndex={stepIndex}
                  onStepChange={(step) => updateStep(stepIndex, step)}
                  onRemoveStep={() => removeStep(stepIndex)}
                />
              ))}
              
              {testCase.steps.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Edit3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No test steps yet. Click &quot;Add Step&quot; to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Expected Result */}
          <div>
            <Label>Overall Expected Result</Label>
            <Textarea
              value={testCase.expected}
              onChange={(e) => onCaseChange({ ...testCase, expected: e.target.value })}
              placeholder="Describe the overall expected outcome when all steps are completed..."
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function TestCaseEditor({ cases, onChange }: TestCaseEditorProps) {
  const addTestCase = () => {
    const newCase: TestCase = {
      id: `case-${Date.now()}`,
      title: "",
      description: "",
      priority: "P2",
      type: "functional",
      steps: [{
        action: "",
        expected: ""
      }],
      expected: ""
    };
    
    onChange([...cases, newCase]);
  };

  const updateCase = (caseIndex: number, testCase: TestCase) => {
    const updatedCases = [...cases];
    updatedCases[caseIndex] = testCase;
    onChange(updatedCases);
  };

  const removeCase = (caseIndex: number) => {
    const updatedCases = cases.filter((_, i) => i !== caseIndex);
    onChange(updatedCases);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Test Cases</h3>
          <p className="text-sm text-muted-foreground">
            Review and edit the generated test cases
          </p>
        </div>
        
        <Button onClick={addTestCase} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Test Case
        </Button>
      </div>

      {cases.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{cases.length} test case{cases.length !== 1 ? 's' : ''}</Badge>
          <span>•</span>
          <span>{cases.reduce((sum, c) => sum + c.steps.length, 0)} total steps</span>
        </div>
      )}

      <div className="space-y-4">
        {cases.map((testCase, caseIndex) => (
          <TestCaseCard
            key={testCase.id}
            testCase={testCase}
            caseIndex={caseIndex}
            onCaseChange={(testCase) => updateCase(caseIndex, testCase)}
            onRemoveCase={() => removeCase(caseIndex)}
          />
        ))}
        
        {cases.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Edit3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No test cases yet. Generate some from the story context.</p>
          </div>
        )}
      </div>
    </div>
  );
}