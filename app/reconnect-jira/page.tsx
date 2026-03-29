'use client';

import { useState } from 'react';

export default function ReconnectJiraPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReconnect = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Call the POST endpoint for OAuth
      const response = await fetch('/api/auth/atlassian/pkce/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (data.authorizeUrl) {
        // Redirect to Atlassian OAuth
        window.location.href = data.authorizeUrl;
      } else {
        setError(data.error || 'Failed to start OAuth flow');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Reconnect to Jira
          </h2>
          <p className="text-gray-600 mb-6">
            Your Jira connection needs to be refreshed. Click below to re-authenticate.
          </p>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <button
            onClick={handleReconnect}
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Redirecting...' : 'Reconnect to Jira'}
          </button>
          
          <p className="mt-4 text-sm text-gray-500">
            This will redirect you to Atlassian to re-authorize access to your Jira site.
          </p>
        </div>
      </div>
    </div>
  );
}