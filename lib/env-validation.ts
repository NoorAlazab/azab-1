/**
 * Environment Configuration Validation
 * Validates all required environment variables at startup
 */

import { z } from 'zod';
import { log } from '@/lib/utils/logger';

// Define environment schema with validation rules
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Application URLs
  APP_URL: z.string().url('APP_URL must be a valid URL').default('http://localhost:3000'),
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL').optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Session & Security
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters for security'),

  // Atlassian OAuth
  ATLASSIAN_CLIENT_ID: z.string().min(1, 'ATLASSIAN_CLIENT_ID is required for Jira integration'),
  ATLASSIAN_CLIENT_SECRET: z.string().min(1, 'ATLASSIAN_CLIENT_SECRET is required for Jira integration'),
  ATLASSIAN_REDIRECT_URI: z.string().url('ATLASSIAN_REDIRECT_URI must be a valid URL'),

  // Email (SMTP) - Optional in development
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().regex(/^\d+$/, 'SMTP_PORT must be a number').optional(),
  SMTP_SECURE: z.enum(['true', 'false']).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email').optional(),
  EMAIL_FROM_NAME: z.string().optional(),

  // AI Provider (Groq) - Optional but recommended
  GROQ_API_KEY: z.string().optional(),

  // Optional AI Providers
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Jira Custom Fields
  JIRA_AC_FIELD_ID: z.string().optional(), // Custom field ID for acceptance criteria
});

export type EnvConfig = z.infer<typeof envSchema>;

// Validation result type
export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  config?: EnvConfig;
}

/**
 * Validate environment variables
 * Returns validation result with errors and warnings
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Parse environment variables
    const config = envSchema.parse(process.env);

    // Additional validation checks

    // Check if email is configured (warn if missing in production)
    if (config.NODE_ENV === 'production') {
      if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
        warnings.push('Email (SMTP) not configured - Email verification will not work in production');
      }

      if (!config.GROQ_API_KEY && !config.OPENAI_API_KEY && !config.ANTHROPIC_API_KEY) {
        warnings.push('No AI provider configured - Test generation and exploration features will use stub data');
      }
    }

    // Validate database URL format
    if (config.DATABASE_URL) {
      if (config.NODE_ENV === 'production' && config.DATABASE_URL.includes('file:')) {
        warnings.push('Using SQLite in production - Consider migrating to PostgreSQL for better performance');
      }
    }

    // Validate APP_URL matches environment
    // Only check this in actual production runtime, not during build
    const isActualProduction = config.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production';
    if (isActualProduction && config.APP_URL.includes('localhost')) {
      errors.push('APP_URL cannot be localhost in production environment');
    }

    // Validate ATLASSIAN_REDIRECT_URI matches APP_URL
    if (!config.ATLASSIAN_REDIRECT_URI.startsWith(config.APP_URL)) {
      warnings.push(`ATLASSIAN_REDIRECT_URI (${config.ATLASSIAN_REDIRECT_URI}) should start with APP_URL (${config.APP_URL})`);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      config,
    };
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const zodErrors = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });

      return {
        success: false,
        errors: zodErrors,
        warnings,
      };
    }

    // Handle unexpected errors
    return {
      success: false,
      errors: [`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
    };
  }
}

/**
 * Validate environment and throw error if validation fails
 * Should be called at application startup
 */
export function validateEnvOrThrow(): EnvConfig {
  const result = validateEnv();

  // Log validation results
  if (result.warnings.length > 0) {
    result.warnings.forEach(warning => {
      log.warn(`Environment warning: ${warning}`, { module: 'EnvValidation' });
    });
  }

  if (!result.success) {
    log.error('Environment validation failed', new Error('Invalid environment configuration'), {
      module: 'EnvValidation',
      errors: result.errors,
    });

    // Print errors to console for visibility
    console.error('\n❌ Environment Validation Failed:\n');
    result.errors.forEach(error => {
      console.error(`  - ${error}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set.\n');

    throw new Error('Environment validation failed. Check logs above for details.');
  }

  log.debug('Environment validation passed', {
    module: 'EnvValidation',
    nodeEnv: result.config!.NODE_ENV,
    hasGroqKey: !!result.config!.GROQ_API_KEY,
    hasEmailConfig: !!(result.config!.SMTP_HOST && result.config!.SMTP_USER),
    warningCount: result.warnings.length,
  });

  return result.config!;
}

/**
 * Get validated environment config
 * Cached after first validation
 */
let cachedConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnvOrThrow();
  }
  return cachedConfig;
}

/**
 * Helper to get specific environment value with type safety
 */
export function getEnv<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
  return getEnvConfig()[key];
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
  return getEnvConfig().NODE_ENV === 'production';
}

/**
 * Check if environment is development
 */
export function isDevelopment(): boolean {
  return getEnvConfig().NODE_ENV === 'development';
}

/**
 * Check if environment is test
 */
export function isTest(): boolean {
  return getEnvConfig().NODE_ENV === 'test';
}
