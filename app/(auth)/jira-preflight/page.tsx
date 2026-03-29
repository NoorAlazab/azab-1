"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, ExternalLink, Copy } from "lucide-react";

interface PreflightResponse {
  ok: boolean;
  reasons?: string[];
  externalStartUrl?: string;
  clientId?: string;
  redirectUri?: string;
  scopes: string[];
  audience: string;
  suggestedExternalHref?: string;
}

export default function JiraPreflightPage() {
  const [preflightData, setPreflightData] = useState<PreflightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreflight = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/auth/atlassian/preflight");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setPreflightData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch preflight data");
      } finally {
        setLoading(false);
      }
    };

    fetchPreflight();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="text-center">Loading preflight check...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Jira OAuth Preflight Check</h1>
        <p className="text-muted-foreground">
          Debug your Atlassian OAuth configuration before starting the auth flow
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {preflightData?.ok ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            Configuration Status
          </CardTitle>
          <CardDescription>
            {preflightData?.ok 
              ? "All environment variables are properly configured" 
              : "Configuration issues found"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preflightData?.reasons && preflightData.reasons.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-semibold">Configuration Issues:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {preflightData.reasons.map((reason, index) => (
                      <li key={index} className="text-sm">{reason}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold">Environment Variables</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Client ID:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={preflightData?.clientId ? "default" : "destructive"}>
                      {preflightData?.clientId ? "SET" : "MISSING"}
                    </Badge>
                    {preflightData?.clientId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(preflightData.clientId!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Redirect URI:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={preflightData?.redirectUri ? "default" : "destructive"}>
                      {preflightData?.redirectUri ? "SET" : "MISSING"}
                    </Badge>
                    {preflightData?.redirectUri && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(preflightData.redirectUri!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">External Starter:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={preflightData?.externalStartUrl ? "default" : "secondary"}>
                      {preflightData?.externalStartUrl ? "SET" : "NOT SET"}
                    </Badge>
                    {preflightData?.externalStartUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(preflightData.externalStartUrl!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">OAuth Configuration</h3>
              
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Scopes:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {preflightData?.scopes.map((scope) => (
                      <Badge key={scope} variant="outline" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Audience:</span>
                  <Badge variant="outline">{preflightData?.audience}</Badge>
                </div>
              </div>
            </div>
          </div>

          {preflightData?.suggestedExternalHref && (
            <div className="space-y-2">
              <h3 className="font-semibold">Generated OAuth URL</h3>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs font-mono break-all text-muted-foreground">
                  {preflightData.suggestedExternalHref}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => copyToClipboard(preflightData.suggestedExternalHref!)}
                  variant="outline"
                  size="sm"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy URL
                </Button>
                <Button
                  onClick={() => window.location.href = preflightData.suggestedExternalHref!}
                  disabled={!preflightData.ok}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  Go to Start URL
                </Button>
              </div>
            </div>
          )}

          {preflightData?.clientId && preflightData?.redirectUri && (
            <div className="space-y-2">
              <h3 className="font-semibold">Values to Copy</h3>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div><strong>Client ID:</strong> {preflightData.clientId}</div>
                <div><strong>Redirect URI:</strong> {preflightData.redirectUri}</div>
              </div>
              <Alert>
                <AlertDescription>
                  Ensure these values exactly match what you have registered in the Atlassian Developer Console.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}