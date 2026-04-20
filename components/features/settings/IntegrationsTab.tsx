'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Unplug,
  Cable,
  Github,
  Slack
} from 'lucide-react';

type ConnectionStatus = 'connected' | 'needs_attention' | 'not_connected';

interface JiraIntegration {
  connected: boolean;
  health: 'healthy' | 'degraded' | 'error';
  siteName?: string;
  activeCloudId?: string;
  lastChecked?: string;
  hasToken: boolean;
}

interface IntegrationStatus {
  jira: JiraIntegration;
}

interface IntegrationsTabProps {
  returnTo?: string;
}

export function IntegrationsTab({ returnTo = '/settings?tab=integrations' }: IntegrationsTabProps) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/integrations/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      // Request OAuth URL from start endpoint
      const res = await fetch('/api/auth/atlassian/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo })
      });

      if (!res.ok) {
        throw new Error('Failed to start OAuth flow');
      }

      const data = await res.json();

      // Redirect to Atlassian OAuth page
      window.location.href = data.authorizeUrl;
    } catch (error) {
      console.error('Failed to start Jira connection:', error);
      alert('❌ Failed to start Jira connection. Please try again.');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/integrations/test/jira', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        alert(`✅ Jira connection test successful!\n\nSite: ${data.siteName}\nUser: ${data.user?.displayName || 'Unknown'}`);
        await fetchStatus(); // Refresh status
      } else {
        alert(`❌ Jira connection test failed:\n\n${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('❌ Connection test failed: Network error');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Jira? This will remove all stored credentials.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/disconnect/jira', { method: 'POST' });
      if (res.ok) {
        alert('✅ Jira disconnected successfully');
        await fetchStatus();
      } else {
        const data = await res.json();
        alert(`❌ Failed to disconnect: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('❌ Disconnect failed: Network error');
    } finally {
      setDisconnecting(false);
    }
  };

  const getJiraStatus = (): ConnectionStatus => {
    if (!status?.jira) return 'not_connected';
    const { connected, health, hasToken } = status.jira;

    if (!connected || !hasToken) return 'not_connected';
    if (health === 'error' || health === 'degraded') return 'needs_attention';
    return 'connected';
  };

  const getStatusBadge = (connectionStatus: ConnectionStatus) => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </Badge>
        );
      case 'needs_attention':
        return (
          <Badge variant="default" className="gap-1 bg-yellow-500 hover:bg-yellow-600">
            <AlertCircle className="h-3 w-3" />
            Needs attention
          </Badge>
        );
      case 'not_connected':
        return (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            Not connected
          </Badge>
        );
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading integration status...</div>;
  }

  const jiraStatus = getJiraStatus();
  const jira = status?.jira;

  return (
    <div className="space-y-4">
      {/* Jira Integration Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <svg className="h-7 w-7 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Jira</h2>
              <p className="text-sm text-muted-foreground">Issue tracking and test case publishing</p>
            </div>
          </div>
          {getStatusBadge(jiraStatus)}
        </div>

        {jiraStatus !== 'not_connected' && jira && (
          <>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-muted-foreground">Site:</span>
                <p className="font-medium">{jira.siteName || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Cloud ID:</span>
                <p className="font-mono text-xs">{jira.activeCloudId || 'Not set'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Health:</span>
                <p className="font-medium capitalize">{jira.health || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Checked:</span>
                <p className="font-medium">
                  {jira.lastChecked
                    ? new Date(jira.lastChecked).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>

            <Separator className="my-4" />
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">SCOPES</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">read:jira-work</Badge>
                <Badge variant="outline">write:jira-work</Badge>
                <Badge variant="outline">read:jira-user</Badge>
                <Badge variant="outline">offline_access</Badge>
              </div>
            </div>

            <Separator className="my-4" />
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">JIRA DEFAULTS (READ-ONLY)</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Default Site:</span>
                  <span className="font-medium">{jira.siteName || 'Auto-select'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Publish Mode:</span>
                  <span className="font-medium">Comment + Subtasks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority Mapping:</span>
                  <span className="font-medium">P0→Highest, P1→High, P2→Medium, P3→Low</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Default Labels:</span>
                  <span className="font-medium text-muted-foreground">None</span>
                </div>
              </div>
            </div>
          </>
        )}

        <Separator className="my-4" />
        <div className="flex gap-2">
          {jiraStatus === 'not_connected' ? (
            <Button onClick={handleConnect} className="gap-2">
              <Cable className="h-4 w-4" />
              Connect to Jira
            </Button>
          ) : (
            <>
              <Button onClick={handleConnect} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reconnect
              </Button>
              <Button
                onClick={handleTest}
                variant="outline"
                disabled={testing}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                onClick={handleDisconnect}
                variant="destructive"
                disabled={disconnecting}
                className="gap-2"
              >
                <Unplug className="h-4 w-4" />
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* GitHub Integration Card (Placeholder) */}
      <Card className="p-6 opacity-60">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Github className="h-7 w-7 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">GitHub</h2>
              <p className="text-sm text-muted-foreground">Code repository and issue tracking</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            Coming Soon
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          GitHub integration will allow you to sync test cases with GitHub Issues and link to pull requests.
        </p>
      </Card>

      {/* GitLab Integration Card (Placeholder) */}
      <Card className="p-6 opacity-60">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <svg className="h-7 w-7 text-orange-600 dark:text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.546 10.93L13.067.452c-.604-.603-1.582-.603-2.188 0L.397 10.93c-.531.529-.531 1.487 0 2.015l10.48 10.479c.604.604 1.582.604 2.186 0l10.483-10.479c.527-.528.527-1.486 0-2.015z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">GitLab</h2>
              <p className="text-sm text-muted-foreground">DevOps platform and CI/CD</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            Coming Soon
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          GitLab integration will enable test case synchronization with GitLab Issues and CI/CD pipeline integration.
        </p>
      </Card>

      {/* Slack Integration Card (Placeholder) */}
      <Card className="p-6 opacity-60">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <Slack className="h-7 w-7 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Slack</h2>
              <p className="text-sm text-muted-foreground">Team communication and notifications</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            Coming Soon
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Slack integration will send notifications when bugs are found or test suites are published.
        </p>
      </Card>
    </div>
  );
}
