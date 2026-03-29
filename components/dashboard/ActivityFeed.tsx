import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  FileText, 
  GitBranch, 
  Upload, 
  Download, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  User,
  Clock
} from "lucide-react";

export interface ActivityEvent {
  id: string;
  type: 'suite_created' | 'test_generated' | 'suite_exported' | 'suite_imported' | 'settings_updated' | 'jira_connected' | 'suite_updated';
  description: string;
  timestamp: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  metadata?: {
    suiteId?: string;
    suiteName?: string;
    storyKey?: string;
    testCount?: number;
    [key: string]: any;
  };
}

export interface ActivityFeedProps {
  events: ActivityEvent[];
  isLoading?: boolean;
  showLimit?: number;
}

export function ActivityFeed({ events, isLoading = false, showLimit = 10 }: ActivityFeedProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'suite_created':
        return FileText;
      case 'test_generated':
        return GitBranch;
      case 'suite_exported':
        return Download;
      case 'suite_imported':
        return Upload;
      case 'settings_updated':
        return Settings;
      case 'jira_connected':
        return CheckCircle;
      case 'suite_updated':
        return FileText;
      default:
        return AlertCircle;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'suite_created':
      case 'test_generated':
        return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
      case 'suite_exported':
      case 'suite_imported':
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
      case 'settings_updated':
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";
      case 'jira_connected':
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400";
      case 'suite_updated':
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    
    return date.toLocaleDateString();
  };

  const displayedEvents = events.slice(0, showLimit);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
          <CardDescription>Your latest actions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
        <CardDescription>Your latest actions and updates</CardDescription>
      </CardHeader>
      <CardContent>
        {displayedEvents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
            <p className="text-xs">Your actions will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedEvents.map((event, index) => {
              const Icon = getEventIcon(event.type);
              const eventColor = getEventColor(event.type);
              
              return (
                <div key={event.id} className="flex space-x-3">
                  <div className="relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${eventColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {index !== displayedEvents.length - 1 && (
                      <div className="absolute left-4 top-8 h-4 w-px bg-border"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium leading-tight">
                        {event.description}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatTimeAgo(event.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                      {event.user && (
                        <div className="flex items-center space-x-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={event.user.avatar} />
                            <AvatarFallback className="text-xs">
                              <User className="h-2 w-2" />
                            </AvatarFallback>
                          </Avatar>
                          <span>{event.user.name}</span>
                        </div>
                      )}
                      
                      {event.metadata?.suiteName && (
                        <Badge variant="outline" className="text-xs">
                          {event.metadata.suiteName}
                        </Badge>
                      )}
                      
                      {event.metadata?.storyKey && (
                        <Badge variant="outline" className="text-xs">
                          {event.metadata.storyKey}
                        </Badge>
                      )}
                      
                      {event.metadata?.testCount && (
                        <span className="text-xs">
                          {event.metadata.testCount} tests
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {events.length > showLimit && (
              <div className="text-center pt-2">
                <span className="text-xs text-muted-foreground">
                  Showing {showLimit} of {events.length} events
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}