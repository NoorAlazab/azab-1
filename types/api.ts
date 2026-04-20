import { z } from "zod";

// Request/Response DTOs

export interface SessionResponse {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  jira: {
    connected: boolean;
    site?: string;
    scopes?: string[];
    activeCloudId?: string | null;
    sites?: Array<{
      id: string;
      name: string;
      url: string;
      scopes: string[];
    }>;
  };
}

export interface AtlassianStartResponse {
  authorizeUrl: string;
}

export interface DisconnectResponse {
  ok: boolean;
}

// Atlassian API Types

export interface AtlassianTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface AtlassianResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl: string;
}

export interface AtlassianMe {
  account_id: string;
  name: string;
  email: string;
  picture: string;
}

// Validation Schemas

export const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const atlassianCallbackSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().min(1, "State parameter is required"),
});

export const csrfTokenSchema = z.object({
  csrfToken: z.string().min(1, "CSRF token is required"),
});

export type EmailRequest = z.infer<typeof emailSchema>;
export type AtlassianCallbackRequest = z.infer<typeof atlassianCallbackSchema>;
export type CSRFTokenRequest = z.infer<typeof csrfTokenSchema>;