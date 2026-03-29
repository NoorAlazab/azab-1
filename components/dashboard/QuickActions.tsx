import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, FileText, Settings, Upload, Download } from "lucide-react";

export interface QuickActionsProps {
  onCreateSuite?: () => void;
  onSearchStories?: () => void;
  onGenerateTests?: () => void;
  onExportSuite?: () => void;
  onImportSuite?: () => void;
  onSettings?: () => void;
}

export function QuickActions({ 
  onCreateSuite, 
  onSearchStories, 
  onGenerateTests,
  onExportSuite,
  onImportSuite,
  onSettings 
}: QuickActionsProps) {
  const actions = [
    {
      icon: PlusCircle,
      title: "Create Suite",
      description: "Start a new test suite",
      onClick: onCreateSuite,
      variant: "default" as const,
    },
    {
      icon: Search,
      title: "Search Stories",
      description: "Find Jira stories",
      onClick: onSearchStories,
      variant: "outline" as const,
    },
    {
      icon: FileText,
      title: "Generate Tests",
      description: "AI test generation",
      onClick: onGenerateTests,
      variant: "outline" as const,
    },
    {
      icon: Upload,
      title: "Import Suite",
      description: "Import test cases",
      onClick: onImportSuite,
      variant: "outline" as const,
    },
    {
      icon: Download,
      title: "Export Suite",
      description: "Export test cases",
      onClick: onExportSuite,
      variant: "outline" as const,
    },
    {
      icon: Settings,
      title: "Settings",
      description: "Configure app",
      onClick: onSettings,
      variant: "outline" as const,
    },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        <CardDescription>
          Common tasks and operations
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant}
              onClick={action.onClick}
              className="h-auto flex-col items-center justify-center p-3 min-h-[88px] text-center border-2"
            >
              <div className="flex flex-col items-center justify-center space-y-2 max-w-full">
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="space-y-1 px-1">
                  <div className="font-medium text-sm leading-tight text-center break-words">
                    {action.title}
                  </div>
                  <div className="text-xs text-muted-foreground leading-tight text-center break-words">
                    {action.description}
                  </div>
                </div>
              </div>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}