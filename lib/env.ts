/**
 * Environment Configuration
 * Central place for accessing validated environment variables
 *
 * This file maintains backward compatibility with existing code
 * while using the new validation system from env-validation.ts
 */

import { getEnvConfig, type EnvConfig } from './env-validation';

// Get validated environment config
// This will throw if validation fails
const config = getEnvConfig();

/**
 * Validated environment configuration
 * All required variables are guaranteed to exist
 */
export const ENV: EnvConfig = config;

/**
 * Server-side environment variables
 * For use in API routes and server components
 */
export const serverEnv = {
  ATLASSIAN_CLIENT_ID: config.ATLASSIAN_CLIENT_ID,
  ATLASSIAN_CLIENT_SECRET: config.ATLASSIAN_CLIENT_SECRET,
  ATLASSIAN_REDIRECT_URI: config.ATLASSIAN_REDIRECT_URI,
  APP_URL: config.APP_URL,
  SESSION_SECRET: config.SESSION_SECRET,
  DATABASE_URL: config.DATABASE_URL,
  NODE_ENV: config.NODE_ENV,
  GROQ_API_KEY: config.GROQ_API_KEY,
  SMTP_HOST: config.SMTP_HOST,
  SMTP_PORT: config.SMTP_PORT,
  SMTP_USER: config.SMTP_USER,
  SMTP_PASS: config.SMTP_PASS,
  EMAIL_FROM: config.EMAIL_FROM,
  EMAIL_FROM_NAME: config.EMAIL_FROM_NAME,
  JIRA_AC_FIELD_ID: config.JIRA_AC_FIELD_ID,
};

/**
 * Public environment variables
 * Safe to expose to client-side code
 */
export const publicEnv = {
  NEXT_PUBLIC_APP_URL: config.NEXT_PUBLIC_APP_URL || config.APP_URL,
  NEXT_PUBLIC_ATLASSIAN_CLIENT_ID: config.ATLASSIAN_CLIENT_ID,
  NEXT_PUBLIC_JIRA_AUTH_START_URL: `${config.APP_URL}/api/auth/atlassian/start`,
};

/**
 * Legacy function for backward compatibility
 * Returns common environment variables
 */
export function getEnv() {
  return {
    ATLASSIAN_CLIENT_ID: config.ATLASSIAN_CLIENT_ID,
    ATLASSIAN_CLIENT_SECRET: config.ATLASSIAN_CLIENT_SECRET,
    ATLASSIAN_REDIRECT_URI: config.ATLASSIAN_REDIRECT_URI,
    APP_URL: config.APP_URL,
    SESSION_SECRET: config.SESSION_SECRET,
    NODE_ENV: config.NODE_ENV,
    DATABASE_URL: config.DATABASE_URL,
  };
}

/**
 * Helper functions for environment checks
 */
export const isProduction = () => config.NODE_ENV === 'production';
export const isDevelopment = () => config.NODE_ENV === 'development';
export const isTest = () => config.NODE_ENV === 'test';

/**
 * Get specific environment variable with type safety
 */
export function getEnvVar<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
  return config[key];
}
