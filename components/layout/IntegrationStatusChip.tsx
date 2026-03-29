'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

type ConnectionStatus = 'connected' | 'needs_attention' | 'not_connected' | 'loading';

interface IntegrationStatus {
  jira: {
    connected: boolean;
    health: 'healthy' | 'degraded' | 'error';
    siteName?: string;
    hasToken: boolean;
  };
}

export function IntegrationStatusChip() {
  const [status, setStatus] = useState<ConnectionStatus>('loading');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/integrations/status');
      if (res.ok) {
        const data: IntegrationStatus = await res.json();
        setStatus(getStatus(data));
      } else {
        setStatus('not_connected');
      }
    } catch (error) {
      setStatus('not_connected');
    }
  };

  const getStatus = (data: IntegrationStatus): ConnectionStatus => {
    const { connected, health, hasToken } = data.jira;

    if (!connected || !hasToken) return 'not_connected';
    if (health === 'error' || health === 'degraded') return 'needs_attention';
    return 'connected';
  };

  if (status === 'loading') {
    return (
      <Badge variant="secondary" className="text-xs gap-1.5 hover:bg-secondary">
        <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
        Jira • Loading...
      </Badge>
    );
  }

  const variants: Record<Exclude<ConnectionStatus, 'loading'>, {
    icon: React.ReactNode;
    text: string;
    className: string;
  }> = {
    connected: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      text: 'Connected',
      className: 'bg-green-500 hover:bg-green-600 text-white',
    },
    needs_attention: {
      icon: <AlertCircle className="h-3 w-3" />,
      text: 'Needs attention',
      className: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    },
    not_connected: {
      icon: <XCircle className="h-3 w-3" />,
      text: 'Not connected',
      className: 'bg-gray-400 hover:bg-gray-500 text-white',
    },
  };

  const variant = variants[status];

  return (
    <Link href="/settings?tab=integrations">
      <Badge variant="default" className={`text-xs gap-1.5 ${variant.className}`}>
        {variant.icon}
        Jira • {variant.text}
      </Badge>
    </Link>
  );
}
