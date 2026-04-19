import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Edit3, Check, X, Plus, GripVertical } from 'lucide-react';

import type { TestCase, TestStep } from '@/lib/generator/types';

interface TestCaseCardProps {
  testCase: TestCase;
  index: number;
  onUpdate: (id: string, updates: Partial<TestCase>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (testCase: TestCase) => void;
  canDelete?: boolean;
}

export function TestCaseCard({ testCase, index, onUpdate, onDelete, onDuplicate, canDelete = true }: TestCaseCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<TestCase>(testCase);

  const handleSave = () => {
    if (testCase.id) {
      onUpdate(testCase.id, editData);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(testCase);
    setIsEditing(false);
  };

  const addStep = () => {
    setEditData({
      ...editData,
      steps: [...editData.steps, { action: '', expected: '' }]
    });
  };

  const updateStep = (stepIndex: number, field: keyof TestStep, value: string) => {
    const newSteps = [...editData.steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value };
    setEditData({ ...editData, steps: newSteps });
  };

  const removeStep = (stepIndex: number) => {
    setEditData({
      ...editData,
      steps: editData.steps.filter((_, i) => i !== stepIndex)
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'bg-red-100 text-red-800';
      case 'P1': return 'bg-orange-100 text-orange-800';
      case 'P2': return 'bg-yellow-100 text-yellow-800';
      case 'P3': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'P0': return 'Critical';
      case 'P1': return 'High';
      case 'P2': return 'Medium';
      case 'P3': return 'Low';
      default: return priority;
    }
  };

  if (isEditing) {
    return (
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-600">Editing Test Case {index + 1}</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} className="h-7">
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} className="h-7">
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={editData.type}
                  onValueChange={(value: any) => setEditData({ ...editData, type: value })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="functional">Functional</SelectItem>
                    <SelectItem value="smoke">Smoke</SelectItem>
                    <SelectItem value="regression">Regression</SelectItem>
                    <SelectItem value="integration">Integration</SelectItem>
                    <SelectItem value="e2e">E2E</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Priority</Label>
                <Select
                  value={editData.priority}
                  onValueChange={(value: any) => setEditData({ ...editData, priority: value })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P0">Critical</SelectItem>
                    <SelectItem value="P1">High</SelectItem>
                    <SelectItem value="P2">Medium</SelectItem>
                    <SelectItem value="P3">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="h-16 text-sm resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Steps</Label>
                <Button size="sm" variant="outline" onClick={addStep} className="h-6 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Step
                </Button>
              </div>
              <div className="space-y-2">
                {editData.steps.map((step, stepIndex) => (
                  <div key={stepIndex} className="border rounded p-2 bg-white">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground mt-1 min-w-[1.5rem]">
                        {stepIndex + 1}.
                      </span>
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Action to perform"
                          value={step.action}
                          onChange={(e) => updateStep(stepIndex, 'action', e.target.value)}
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="Expected result"
                          value={step.expected}
                          onChange={(e) => updateStep(stepIndex, 'expected', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeStep(stepIndex)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {editData.steps.length === 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground border-2 border-dashed rounded">
                    No steps added yet. Click &quot;Add Step&quot; to get started.
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs">Overall Expected Result</Label>
              <Textarea
                value={editData.expected}
                onChange={(e) => setEditData({ ...editData, expected: e.target.value })}
                className="h-12 text-sm resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <GripVertical className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-medium text-sm leading-tight">{testCase.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {testCase.type}
                </Badge>
                <Badge className={`text-xs ${getPriorityColor(testCase.priority)}`}>
                  {getPriorityLabel(testCase.priority)}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                className="h-7 w-7 p-0"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDuplicate(testCase)}
                className="h-7 w-7 p-0"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(testCase.id || `temp-${index}`)}
                disabled={!canDelete}
                className={`h-7 w-7 p-0 ${canDelete ? 'text-red-500 hover:text-red-700' : 'text-gray-300 cursor-not-allowed'}`}
                title={!canDelete ? "Minimum 3 test cases required" : "Delete test case"}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Description */}
          {testCase.description && (
            <p className="text-xs text-muted-foreground">{testCase.description}</p>
          )}

          <Separator />

          {/* Steps */}
          {testCase.steps && testCase.steps.length > 0 && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Test Steps:</Label>
              <ol className="text-xs space-y-1 mt-1">
                {testCase.steps.map((step, stepIndex) => (
                  <li key={stepIndex} className="flex items-start gap-2">
                    <span className="text-muted-foreground min-w-[1.5rem]">{stepIndex + 1}.</span>
                    <div className="flex-1">
                      <div>{step.action}</div>
                      {step.expected && step.expected !== testCase.expected && (
                        <div className="text-green-600 mt-0.5">→ {step.expected}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Overall Expected Result */}
          {testCase.expected && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Expected Result:</Label>
              <p className="text-xs mt-1 text-green-700 bg-green-50 rounded p-2">
                {testCase.expected}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}