/**
 * Credential Encryption Utilities
 * Encrypts/decrypts environment credentials using AES-256-GCM
 * Reuses the same approach as Jira token encryption
 */

import { encrypt, decrypt } from './secrets';

/**
 * Encrypt username for storage
 */
export function encryptUsername(username: string): string {
  if (!username) {
    throw new Error('Username cannot be empty');
  }
  return encrypt(username);
}

/**
 * Decrypt username from storage
 */
export function decryptUsername(encrypted: string): string {
  if (!encrypted) {
    throw new Error('Encrypted username cannot be empty');
  }
  return decrypt(encrypted);
}

/**
 * Encrypt password for storage
 */
export function encryptPassword(password: string): string {
  if (!password) {
    throw new Error('Password cannot be empty');
  }
  return encrypt(password);
}

/**
 * Decrypt password from storage
 */
export function decryptPassword(encrypted: string): string {
  if (!encrypted) {
    throw new Error('Encrypted password cannot be empty');
  }
  return decrypt(encrypted);
}

/**
 * Encrypt both username and password
 */
export function encryptCredentials(username: string, password: string): {
  usernameEncrypted: string;
  passwordEncrypted: string;
} {
  return {
    usernameEncrypted: encryptUsername(username),
    passwordEncrypted: encryptPassword(password),
  };
}

/**
 * Decrypt both username and password
 */
export function decryptCredentials(
  usernameEncrypted: string,
  passwordEncrypted: string
): {
  username: string;
  password: string;
} {
  return {
    username: decryptUsername(usernameEncrypted),
    password: decryptPassword(passwordEncrypted),
  };
}
