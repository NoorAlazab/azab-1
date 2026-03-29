'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Legacy integrations page - redirects to Settings page
 * This maintains backward compatibility with existing links
 */
export default function IntegrationsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to Settings page with integrations tab
    router.replace('/settings?tab=integrations');
  }, [router]);

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Redirecting to Settings...</p>
        </div>
      </div>
    </div>
  );
}
