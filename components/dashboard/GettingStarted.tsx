import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, ArrowRight } from "lucide-react";

export interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  optional?: boolean;
}

export interface ChecklistState {
  connectJira: boolean;
  configureLLM: boolean;
  chooseStorageMode: boolean;
  firstSuite: boolean;
}

export interface GettingStartedProps {
  checklist: ChecklistState;
  onUpdateItem?: (key: keyof ChecklistState, value: boolean) => void;
  onItemAction?: (key: string) => void;
}

export function GettingStarted({ checklist, onUpdateItem, onItemAction }: GettingStartedProps) {
  const checklistItems: ChecklistItem[] = [
    {
      key: 'connectJira',
      label: 'Connect to Jira',
      description: 'Link your Atlassian account to import stories',
      completed: checklist.connectJira,
    },
    {
      key: 'configureLLM',
      label: 'Configure AI Model',
      description: 'Set up your preferred AI provider for test generation',
      completed: checklist.configureLLM,
    },
    {
      key: 'chooseStorageMode',
      label: 'Choose Storage Mode',
      description: 'Select how you want to store and sync test cases',
      completed: checklist.chooseStorageMode,
    },
    {
      key: 'firstSuite',
      label: 'Create First Test Suite',
      description: 'Generate your first set of test cases from a Jira story',
      completed: checklist.firstSuite,
    },
  ];

  const completedCount = checklistItems.filter(item => item.completed).length;
  const totalCount = checklistItems.length;
  const progressPercentage = (completedCount / totalCount) * 100;

  const getActionLabel = (key: string) => {
    switch (key) {
      case 'connectJira':
        return 'Connect Now';
      case 'configureLLM':
        return 'Configure';
      case 'chooseStorageMode':
        return 'Choose Mode';
      case 'firstSuite':
        return 'Create Suite';
      default:
        return 'Get Started';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">Getting Started</CardTitle>
            <CardDescription>
              Complete these steps to set up QA CaseForge
            </CardDescription>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium text-brand">
              {completedCount}/{totalCount}
            </div>
            <div className="text-xs text-muted-foreground">
              completed
            </div>
          </div>
        </div>
        <div className="pt-2">
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {checklistItems.map((item, index) => (
          <div 
            key={item.key}
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
              item.completed 
                ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800' 
                : 'bg-muted/30 hover:bg-muted/50'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {item.completed ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className={`text-sm font-medium ${
                    item.completed ? 'text-green-900 dark:text-green-100' : 'text-foreground'
                  }`}>
                    {item.label}
                    {item.optional && (
                      <span className="ml-2 text-xs text-muted-foreground">(Optional)</span>
                    )}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                
                {!item.completed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onItemAction?.(item.key)}
                    className="ml-4 flex-shrink-0"
                  >
                    {getActionLabel(item.key)}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {completedCount === totalCount && (
          <div className="text-center p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/10 dark:to-blue-900/10 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
              🎉 All set up!
            </h3>
            <p className="text-xs text-green-700 dark:text-green-200 mb-3">
              You've completed the initial setup. Start generating test cases from your Jira stories.
            </p>
            <Button size="sm" onClick={() => onItemAction?.('explore')}>
              Explore Features
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}