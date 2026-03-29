"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, ExternalLink, CheckCircle } from "lucide-react";

interface DebugData {
  authorizeUrl: string;
  parsedParams: Record<string, string>;
}

export default function OAuthDebugPage() {
  const router = useRouter();
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>("");

  // Protect debug routes in production
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      router.push('/dashboard');
    }
  }, [router]);

  const loadDebugData = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/auth/atlassian/pkce/start", {
        method: "GET"
      });
      
      if (!response.ok) {
        throw new Error("Failed to load debug data");
      }
      
      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startOAuth = async () => {
    try {
      const response = await fetch("/api/auth/atlassian/pkce/start", {
        method: "POST"
      });
      
      if (!response.ok) {
        throw new Error("Failed to start OAuth");
      }
      
      const { authorizeUrl } = await response.json();
      window.location.href = authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth");
    }
  };

  useEffect(() => {
    loadDebugData();
  }, []);

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">OAuth Debug Page</h1>
          <p className="text-muted-foreground">
            Debug Atlassian OAuth parameters and authorize URL
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                OAuth Parameters
              </CardTitle>
              <CardDescription>
                Parsed parameters that will be sent to Atlassian
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && <p>Loading...</p>}
              
              {debugData?.parsedParams && (
                <div className="space-y-2">
                  {Object.entries(debugData.parsedParams).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-2 text-sm">
                      <div className="font-mono text-blue-600">{key}:</div>
                      <div className="col-span-2 font-mono break-all">
                        {key === 'client_id' && (
                          <span className="bg-green-100 px-1 rounded">
                            {value}
                          </span>
                        )}
                        {key === 'redirect_uri' && (
                          <span className="bg-blue-100 px-1 rounded">
                            {value}
                          </span>
                        )}
                        {key !== 'client_id' && key !== 'redirect_uri' && value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Authorize URL</CardTitle>
              <CardDescription>
                Full URL that will be used for OAuth authorization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {debugData?.authorizeUrl && (
                <div className="space-y-4">
                  <div className="relative">
                    <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                      {debugData.authorizeUrl}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(debugData.authorizeUrl)}
                    >
                      {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.open(debugData.authorizeUrl, '_blank')}
                      variant="outline"
                      className="flex-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </Button>
                    
                    <Button
                      onClick={startOAuth}
                      className="flex-1"
                    >
                      Start OAuth Flow
                    </Button>
                  </div>
                </div>
              )}
              
              <Button
                onClick={loadDebugData}
                disabled={loading}
                variant="outline"
                className="w-full mt-4"
              >
                {loading ? "Loading..." : "Refresh Debug Data"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Verification Checklist</CardTitle>
            <CardDescription>
              Verify these parameters match your Atlassian OAuth app configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  client_id = <code className="bg-gray-100 px-1 rounded">500b17e6-1dde-4464-b0c3-22a6151239f0</code>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  redirect_uri = <code className="bg-gray-100 px-1 rounded">http://localhost:3000/api/auth/atlassian/callback</code>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  audience = <code className="bg-gray-100 px-1 rounded">api.atlassian.com</code>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  PKCE: code_challenge + S256 method present
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}