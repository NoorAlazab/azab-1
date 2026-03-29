import type { ExplorationRole, EphemeralUserRef } from "./types";

export interface ProvisionUserOptions {
  role: ExplorationRole;
  envUrl: string;
  tenantHint?: string;
}

export interface LoginCaptureOptions {
  envUrl: string;
  role: ExplorationRole;
  user: EphemeralUserRef;
}

export interface StorageStateResult {
  storageStateId: string;
}

/**
 * Provisions an ephemeral user account for the given role.
 * 
 * In production, this would:
 * - Call ATS API to create a temporary account
 * - Assign appropriate role/permissions
 * - Return user credentials and metadata
 * 
 * Currently mocked for development.
 */
export async function provisionEphemeralUser(opts: ProvisionUserOptions): Promise<EphemeralUserRef> {
  // Mock delay to simulate API call
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  const runId = generateRunId();
  const userId = `ephemeral_${opts.role}_${runId}`;
  const email = `${opts.role}+${runId}@example.test`;
  
  return {
    id: userId,
    email: email,
    role: opts.role,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Tears down an ephemeral user account.
 * 
 * In production, this would:
 * - Deactivate the account in the ATS
 * - Clean up any associated data
 * - Revoke permissions
 * 
 * Currently mocked for development.
 */
export async function teardownEphemeralUser(ref: EphemeralUserRef): Promise<void> {
  // Mock delay to simulate API call
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
  
  console.log(`[MOCK] Tearing down ephemeral user: ${ref.email} (${ref.role})`);
  
  // In production: actual cleanup logic here
}

/**
 * Logs into the target environment with the ephemeral user and captures browser storage state.
 * 
 * In production, this would:
 * - Use Playwright to navigate to login page
 * - Fill credentials and submit login form
 * - Capture cookies, localStorage, sessionStorage
 * - Save storage state for reuse in exploration runs
 * 
 * Currently mocked for development.
 */
export async function loginAndCaptureStorageState(opts: LoginCaptureOptions): Promise<StorageStateResult> {
  // Mock delay to simulate browser automation
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  const storageStateId = `storage_${opts.user.id}_${Date.now()}`;
  
  console.log(`[MOCK] Logging in as ${opts.user.email} (${opts.role}) to ${opts.envUrl}`);
  console.log(`[MOCK] Captured storage state: ${storageStateId}`);
  
  return {
    storageStateId: storageStateId,
  };
}

// Helper function to generate consistent run IDs
function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${timestamp}_${random}`;
}

// Export for testing
export const __internal = {
  generateRunId,
};