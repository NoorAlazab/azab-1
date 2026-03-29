/**
 * Environment Configuration Types
 * For managing test environment credentials and selector metadata
 */

export interface PageRecordingMetadata {
  recordedAt: string; // ISO timestamp
  recordedBy?: string; // Story key that triggered recording
  elementCount: number;
  lastValidated?: string | null;
}

export interface PagesMetadata {
  [pageName: string]: PageRecordingMetadata;
}

export interface EnvironmentConfig {
  id: string;
  userId: string;
  environmentUrl: string; // Original URL (e.g., http://localhost:3000)
  environmentSlug: string; // Normalized slug (e.g., localhost-3000)
  usernameEncrypted: string | null; // Encrypted username
  passwordEncrypted: string | null; // Encrypted password
  pagesMetadataJson: PagesMetadata | null;
  lastRecordedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentCredentials {
  username: string;
  password: string;
}

export interface SelectorRecordingResult {
  page: string;
  elementsRecorded: number;
  filePath: string;
  success: boolean;
  error?: string;
}

export interface RecordingProgress {
  page: string;
  status: 'pending' | 'recording' | 'completed' | 'failed';
  elementCount?: number;
  error?: string;
}

export interface CheckSelectorsResult {
  hasSelectors: string[]; // Pages that have selectors
  needsRecording: string[]; // Pages that need recording
  environmentExists: boolean;
}

export interface RecordSelectorsRequest {
  environment: string;
  username?: string;
  password?: string;
  pages: string[];
  storyKey?: string; // For metadata tracking
  saveCredentials?: boolean;
}

export interface RecordSelectorsResponse {
  success: boolean;
  environmentSlug: string;
  recordedPages: SelectorRecordingResult[];
  skippedPages: string[]; // Pages that already had selectors
  totalElements: number;
  journeys?: any[]; // Journey data if using journey-based recording
  error?: string;
}
