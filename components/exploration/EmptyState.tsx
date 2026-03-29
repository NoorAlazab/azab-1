"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, FileText, ExternalLink, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ 
  title = "Start Your First Exploration",
  description = "Select a Jira story or upload a PDF to begin automated bug hunting.",
  action,
  className 
}: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-12 pb-12">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Search className="h-8 w-8 text-primary" />
          </div>
          
          <h3 className="mb-2 text-lg font-semibold">{title}</h3>
          <p className="mb-8 text-sm text-muted-foreground max-w-md mx-auto">
            {description}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              <span>Analyze Jira stories</span>
            </div>
            
            <div className="hidden sm:block text-muted-foreground">•</div>
            
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Upload PDF manuals</span>
            </div>
          </div>
          
          {action && (
            <Button onClick={action.onClick} className="gap-2">
              {action.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}