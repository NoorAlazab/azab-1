/**
 * Environment Manager
 * Manages environment configurations including credentials and selector metadata
 */

import { prisma } from '@/lib/db/prisma';
import { encryptCredentials, decryptCredentials } from '@/lib/crypto/credentials';
import type {
  EnvironmentConfig,
  EnvironmentCredentials,
  PagesMetadata,
  PageRecordingMetadata
} from '@/types/environment';
import { log } from '@/lib/utils/logger';

/**
 * Normalize environment URL to create a consistent slug
 * Examples:
 *   http://localhost:3000 → localhost-3000
 *   https://staging.example.com → staging-example-com
 *   https://staging.example.com:8080 → staging-example-com-8080
 */
export function normalizeEnvironmentUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let slug = urlObj.hostname.replace(/\./g, '-');

    // Add port if not default
    if (urlObj.port && urlObj.port !== '80' && urlObj.port !== '443') {
      slug += `-${urlObj.port}`;
    }

    return slug;
  } catch (error) {
    // Fallback for invalid URLs
    log.warn('Failed to parse environment URL', {
      module: 'EnvironmentManager',
      url,
      error: error instanceof Error ? error.message : String(error)
    });
    return url.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }
}

/**
 * Save or update environment configuration
 */
export async function saveEnvironmentConfig(
  userId: string,
  environmentUrl: string,
  credentials?: EnvironmentCredentials,
  pagesMetadata?: PagesMetadata
): Promise<EnvironmentConfig> {
  const environmentSlug = normalizeEnvironmentUrl(environmentUrl);

  log.debug('Saving environment config', {
    module: 'EnvironmentManager',
    userId,
    environmentUrl,
    environmentSlug,
    hasCredentials: !!credentials,
  });

  // Encrypt credentials if provided
  let usernameEncrypted: string | null = null;
  let passwordEncrypted: string | null = null;

  if (credentials && credentials.username && credentials.password) {
    const encrypted = encryptCredentials(credentials.username, credentials.password);
    usernameEncrypted = encrypted.usernameEncrypted;
    passwordEncrypted = encrypted.passwordEncrypted;
  }

  // Check if config already exists
  const existing = await prisma.environmentConfig.findUnique({
    where: {
      userId_environmentSlug: {
        userId,
        environmentSlug,
      },
    },
  });

  if (existing) {
    // Update existing
    const updated = await prisma.environmentConfig.update({
      where: { id: existing.id },
      data: {
        environmentUrl,
        usernameEncrypted: usernameEncrypted ?? existing.usernameEncrypted,
        passwordEncrypted: passwordEncrypted ?? existing.passwordEncrypted,
        // Only update pagesMetadataJson if pagesMetadata was provided
        ...(pagesMetadata !== undefined && { pagesMetadataJson: pagesMetadata as any }),
        lastRecordedAt: pagesMetadata ? new Date() : existing.lastRecordedAt,
      },
    });

    return updated as EnvironmentConfig;
  } else {
    // Create new
    const created = await prisma.environmentConfig.create({
      data: {
        userId,
        environmentUrl,
        environmentSlug,
        usernameEncrypted,
        passwordEncrypted,
        pagesMetadataJson: (pagesMetadata ?? null) as any,
        lastRecordedAt: pagesMetadata ? new Date() : null,
      },
    });

    return created as EnvironmentConfig;
  }
}

/**
 * Get environment configuration
 */
export async function getEnvironmentConfig(
  userId: string,
  environmentUrl: string
): Promise<EnvironmentConfig | null> {
  const environmentSlug = normalizeEnvironmentUrl(environmentUrl);

  const config = await prisma.environmentConfig.findUnique({
    where: {
      userId_environmentSlug: {
        userId,
        environmentSlug,
      },
    },
  });

  return config as EnvironmentConfig | null;
}

/**
 * Get decrypted credentials from environment config
 */
export async function getEnvironmentCredentials(
  userId: string,
  environmentUrl: string
): Promise<EnvironmentCredentials | null> {
  const config = await getEnvironmentConfig(userId, environmentUrl);

  if (!config || !config.usernameEncrypted || !config.passwordEncrypted) {
    return null;
  }

  try {
    const decrypted = decryptCredentials(
      config.usernameEncrypted,
      config.passwordEncrypted
    );
    return decrypted;
  } catch (error) {
    log.error('Failed to decrypt credentials', error instanceof Error ? error : new Error(String(error)), {
      module: 'EnvironmentManager',
      userId,
      environmentUrl,
    });
    return null;
  }
}

/**
 * Get list of pages that have been recorded for an environment
 */
export async function getRecordedPages(
  userId: string,
  environmentUrl: string
): Promise<string[]> {
  const config = await getEnvironmentConfig(userId, environmentUrl);

  if (!config || !config.pagesMetadataJson) {
    return [];
  }

  const metadata = config.pagesMetadataJson as PagesMetadata;
  return Object.keys(metadata);
}

/**
 * Check if specific pages have selectors recorded
 */
export async function checkPagesRecorded(
  userId: string,
  environmentUrl: string,
  pages: string[]
): Promise<{
  hasSelectors: string[];
  needsRecording: string[];
}> {
  const recordedPages = await getRecordedPages(userId, environmentUrl);

  const hasSelectors: string[] = [];
  const needsRecording: string[] = [];

  for (const page of pages) {
    if (recordedPages.includes(page)) {
      hasSelectors.push(page);
    } else {
      needsRecording.push(page);
    }
  }

  return { hasSelectors, needsRecording };
}

/**
 * Update pages metadata after recording
 */
export async function updatePagesMetadata(
  userId: string,
  environmentUrl: string,
  pageUpdates: Record<string, PageRecordingMetadata>
): Promise<void> {
  const config = await getEnvironmentConfig(userId, environmentUrl);

  if (!config) {
    throw new Error('Environment config not found');
  }

  // Merge with existing metadata
  const existingMetadata = (config.pagesMetadataJson as PagesMetadata) || {};
  const updatedMetadata = {
    ...existingMetadata,
    ...pageUpdates,
  };

  await prisma.environmentConfig.update({
    where: { id: config.id },
    data: {
      pagesMetadataJson: updatedMetadata as any,
      lastRecordedAt: new Date(),
    },
  });

  log.debug('Updated pages metadata', {
    module: 'EnvironmentManager',
    userId,
    environmentUrl,
    pagesUpdated: Object.keys(pageUpdates),
  });
}

/**
 * Delete environment configuration
 */
export async function deleteEnvironmentConfig(
  userId: string,
  environmentUrl: string
): Promise<void> {
  const environmentSlug = normalizeEnvironmentUrl(environmentUrl);

  await prisma.environmentConfig.deleteMany({
    where: {
      userId,
      environmentSlug,
    },
  });

  log.debug('Deleted environment config', {
    module: 'EnvironmentManager',
    userId,
    environmentUrl,
  });
}
