import { webcrypto } from "crypto";

/**
 * Generate a random identifier string
 */
export function randomId(length = 32): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  
  const array = new Uint8Array(length);
  webcrypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  
  return result;
}

/**
 * Generate random bytes for cryptographic purposes
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  webcrypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Base64url encode (URL-safe base64 without padding)
 */
export function base64urlEncode(bytes: Uint8Array): string {
  const base64 = Buffer.from(bytes).toString("base64");
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Base64url decode
 */
export function base64urlDecode(str: string): Uint8Array {
  // Add padding if needed
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/**
 * SHA256 hash with base64url encoding
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const hashBuffer = await webcrypto.subtle.digest("SHA-256", dataBytes);
  const hashArray = new Uint8Array(hashBuffer);
  return base64urlEncode(hashArray);
}

/**
 * Generate PKCE code verifier (43-128 characters, URL-safe)
 */
export function generateCodeVerifier(): string {
  const bytes = randomBytes(32); // 32 bytes = 43 characters when base64url encoded
  return base64urlEncode(bytes);
}

/**
 * Generate PKCE code challenge from verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  return await sha256(verifier);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}