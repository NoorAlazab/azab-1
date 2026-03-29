import { describe, it, expect } from 'vitest';
import { 
  randomId, 
  base64urlEncode, 
  base64urlDecode, 
  generateCodeVerifier, 
  generateCodeChallenge,
  constantTimeEqual 
} from '@/lib/crypto';

describe('Crypto utilities', () => {
  describe('randomId', () => {
    it('should generate random string of specified length', () => {
      const id1 = randomId(32);
      const id2 = randomId(32);
      
      expect(id1).toHaveLength(32);
      expect(id2).toHaveLength(32);
      expect(id1).not.toBe(id2);
    });

    it('should generate default length of 32', () => {
      const id = randomId();
      expect(id).toHaveLength(32);
    });
  });

  describe('base64url encoding/decoding', () => {
    it('should encode and decode correctly', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const encoded = base64urlEncode(original);
      const decoded = base64urlDecode(encoded);
      
      expect(decoded).toEqual(original);
    });

    it('should produce URL-safe strings', () => {
      const data = new Uint8Array([62, 63, 64]); // These produce + and / in regular base64
      const encoded = base64urlEncode(data);
      
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });
  });

  describe('PKCE', () => {
    it('should generate valid code verifier', () => {
      const verifier = generateCodeVerifier();
      
      expect(verifier).toHaveLength(43); // 32 bytes base64url encoded = 43 chars
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate consistent code challenge', async () => {
      const verifier = 'test-verifier';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);
      
      expect(challenge1).toBe(challenge2);
    });
  });

  describe('constantTimeEqual', () => {
    it('should return true for equal strings', () => {
      expect(constantTimeEqual('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(constantTimeEqual('hello', 'world')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(constantTimeEqual('hello', 'hi')).toBe(false);
    });
  });
});