import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Clock } from "lucide-react";

export interface JiraStory {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee?: string;
  priority?: string;
  storyPoints?: number;
  labels?: string[];
  updated: string;
}

export interface RecentStoriesProps {
  stories: JiraStory[];
  isLoading?: boolean;
  onViewAll?: () => void;
  onGenerateTests?: (story: JiraStory) => void;
}

export function RecentStories({ 
  stories, 
  isLoading = false, 
  onViewAll, 
  onGenerateTests 
}: RecentStoriesProps) {
  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes('done') || normalizedStatus.includes('resolved')) {
      return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    }
    if (normalizedStatus.includes('progress') || normalizedStatus.includes('review')) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
    }
    if (normalizedStatus.includes('todo') || normalizedStatus.includes('open')) {
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
  };

  const getPriorityColor = (priority?: string) => {
    if (!priority) return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    
    const normalizedPriority = priority.toLowerCase();
    if (normalizedPriority.includes('high') || normalizedPriority.includes('critical')) {
      return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
    }
    if (normalizedPriority.includes('medium')) {
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
    }
    return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w ago`;
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-medium">Recent Stories</CardTitle>
          <CardDescription>Latest Jira stories from your projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-medium">Recent Stories</CardTitle>
          <CardDescription>Latest Jira stories from your projects</CardDescription>
        </div>
        {stories.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {stories.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent stories found</p>
            <p className="text-xs">Connect to Jira to see your stories</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stories.map((story) => (
              <div 
                key={story.id} 
                className="border rounded-lg p-3 space-y-2 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-mono text-muted-foreground">
                        {story.key}
                      </span>
                      {story.storyPoints && (
                        <Badge variant="outline" className="text-xs">
                          {story.storyPoints} pts
                        </Badge>
                      )}
                    </div>
                    <h4 className="text-sm font-medium leading-tight mb-2 line-clamp-2">
                      {story.summary}
                    </h4>
                    <div className="flex items-center space-x-2 text-xs">
                      <Badge className={getStatusColor(story.status)} variant="secondary">
                        {story.status}
                      </Badge>
                      {story.priority && (
                        <Badge className={getPriorityColor(story.priority)} variant="secondary">
                          {story.priority}
                        </Badge>
                      )}
                      <span className="text-muted-foreground flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimeAgo(story.updated)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {story.labels && story.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {story.labels.slice(0, 3).map((label, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                    {story.labels.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{story.labels.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-1">
                  {story.assignee && (
                    <span className="text-xs text-muted-foreground">
                      Assignee: {story.assignee}
                    </span>
                  )}
                  <div className="flex space-x-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onGenerateTests?.(story)}
                      className="h-7 px-2 text-xs"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Generate Tests
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`https://jira.example.com/browse/${story.key}`, "_blank")}
                      className="h-7 px-2 text-xs"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}