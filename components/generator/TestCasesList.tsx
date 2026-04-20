import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Search, Filter, Download, Upload, Trash2, Copy, Wand2 } from 'lucide-react';
import { TestCaseCard } from './TestCaseCard';

import type { TestCase, TestStep } from '@/lib/server/generator/types';

interface TestCasesListProps {
  cases: TestCase[];
  onUpdate: (id: string, updates: Partial<TestCase>) => void;
  onDelete: (id: string) => void;
  onAdd: (testCase: Omit<TestCase, 'id'>) => void;
  onClear: () => void;
  onGenerateFromStory?: () => void;
  hasStory?: boolean;
  isLoading?: boolean;
  hasGenerationConfig?: boolean;
}

export function TestCasesList({ 
  cases, 
  onUpdate, 
  onDelete, 
  onAdd, 
  onClear,
  onGenerateFromStory,
  hasStory = false,
  hasGenerationConfig = false,
  isLoading = false 
}: TestCasesListProps) {
  console.log('TestCasesList rendered with props:', { 
    casesCount: cases.length, 
    hasStory, 
    hasOnGenerateFromStory: !!onGenerateFromStory,
    isLoading 
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const filteredCases = cases.filter(testCase => {
    const matchesSearch = testCase.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (testCase.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || testCase.type === filterType;
    const matchesPriority = filterPriority === 'all' || testCase.priority === filterPriority;
    
    return matchesSearch && matchesType && matchesPriority;
  });

  const handleDuplicate = (testCase: TestCase) => {
    const newTestCase = {
      ...testCase,
      title: `${testCase.title} (Copy)`,
    };
    delete (newTestCase as any).id;
    onAdd(newTestCase);
  };

  const handleAddNew = () => {
    const newTestCase: Omit<TestCase, 'id'> = {
      title: 'New Test Case',
      description: 'Test case description',
      type: 'functional',
      priority: 'P2',
      steps: [
        { action: 'Navigate to the feature', expected: 'Page loads successfully' },
        { action: 'Perform the main action', expected: 'Action completes successfully' },
        { action: 'Verify the result', expected: 'Expected outcome is displayed' }
      ],
      expected: 'Test passes successfully'
    };
    onAdd(newTestCase);
  };

  const exportCases = () => {
    const dataStr = JSON.stringify(cases, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'test-cases.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getCaseStats = () => {
    const stats = {
      total: cases.length,
      p0: cases.filter(c => c.priority === 'P0').length,
      p1: cases.filter(c => c.priority === 'P1').length,
      p2: cases.filter(c => c.priority === 'P2').length,
      p3: cases.filter(c => c.priority === 'P3').length,
      functional: cases.filter(c => c.type === 'functional').length,
      negative: cases.filter(c => c.type === 'negative').length,
      boundary: cases.filter(c => c.type === 'boundary').length,
      accessibility: cases.filter(c => c.type === 'accessibility').length,
      security: cases.filter(c => c.type === 'security').length,
      performance: cases.filter(c => c.type === 'performance').length,
    };
    return stats;
  };

  const stats = getCaseStats();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5"></div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No test cases drafted yet.
          </p>
          <p className="text-xs text-muted-foreground">
            {hasStory ? "Generate AI-powered test cases from your story, or add manually." : "Fetch a story first, then generate test cases or add one manually."}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            {hasStory && onGenerateFromStory && (
              <Button 
                size="sm" 
                onClick={() => {
                  console.log('Button clicked in TestCasesList component');
                  onGenerateFromStory();
                }} 
                className={hasGenerationConfig ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                {hasGenerationConfig ? "Generate with Settings" : "Generate from Story"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleAddNew}>
              <Plus className="h-3 w-3 mr-1" />
              Add Test Case
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">Test Cases ({stats.total})</h3>
          <div className="flex gap-1">
            {stats.p0 > 0 && <Badge variant="outline" className="text-xs">Critical: {stats.p0}</Badge>}
            {stats.p1 > 0 && <Badge variant="outline" className="text-xs">High: {stats.p1}</Badge>}
            {stats.p2 > 0 && <Badge variant="outline" className="text-xs">Medium: {stats.p2}</Badge>}
            {stats.p3 > 0 && <Badge variant="outline" className="text-xs">Low: {stats.p3}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={exportCases} className="h-7 text-xs">
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <Button size="sm" variant="ghost" onClick={handleAddNew} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
          {cases.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onClear} className="h-7 text-xs text-red-600 hover:text-red-700">
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {cases.length > 3 && (
        <div className="flex items-center gap-2 text-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
            <Input
              placeholder="Search test cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="functional">Functional</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
              <SelectItem value="boundary">Boundary</SelectItem>
              <SelectItem value="accessibility">Accessibility</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="P0">Critical</SelectItem>
              <SelectItem value="P1">High</SelectItem>
              <SelectItem value="P2">Medium</SelectItem>
              <SelectItem value="P3">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      {/* Test Cases */}
      <div className="max-h-[400px] overflow-auto pr-2 thin-scrollbar">
        <div className="space-y-3">
          {filteredCases.length > 0 ? (
            filteredCases.map((testCase, index) => (
              <TestCaseCard
                key={testCase.id}
                testCase={testCase}
                index={index}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onDuplicate={handleDuplicate}
              />
            ))
          ) : (
            <div className="text-center py-4 text-xs text-muted-foreground">
              No test cases match your filters.
            </div>
          )}
        </div>
      </div>

      {/* Summary Footer */}
      {filteredCases.length !== cases.length && (
        <div className="text-xs text-muted-foreground text-center">
          Showing {filteredCases.length} of {cases.length} test cases
        </div>
      )}
    </div>
  );
}