export interface AppUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionPayload {
  userId: string;
  email: string;
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
  jira?: JiraConnection;
}

export interface JiraSite {
  id: string;        // cloudId
  name: string;      // site name
  url: string;       // https://<site>.atlassian.net
  scopes: string[];  // granted scopes
}

export interface JiraConnection {
  connected: boolean;
  activeCloudId?: string | null;
  activeSiteName?: string | null;
  sites?: JiraSite[];  // all accessible resources
  scopes?: string[];   // union of granted scopes
  accessTokenEncrypted?: string;
  refreshTokenEncrypted?: string;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Legacy interface for backward compatibility
export interface JiraConnectionLegacy {
  userId: string;
  siteId: string;
  siteName: string;
  cloudId: string;
  scopes: string[];
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MagicLinkToken {
  token: string;
  email: string;
  expiresAt: Date;
  used: boolean;
}

export interface PKCESession {
  nonce: string;
  codeVerifier: string;
  state: string;
  createdAt: Date;
  expiresAt: Date;
  returnTo?: string; // Optional redirect path after OAuth completion
}