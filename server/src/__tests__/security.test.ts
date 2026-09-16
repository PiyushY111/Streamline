import { describe, it, expect, vi } from 'vitest';
import { generateCsrfToken, csrfProtection } from '../middlewares/security.js';
import { encrypt, decrypt } from '../utils/encryption.js';

describe('Security & Protection Unit Tests', () => {
  describe('CSRF Protection', () => {
    it('should generate a 64-character hex CSRF token', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('should allow GET requests without CSRF verification', () => {
      const req: any = { method: 'GET', path: '/api/emails', headers: {}, cookies: {} };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow mutating requests with matching X-CSRF-Token and cookie', () => {
      const token = generateCsrfToken();
      const req: any = {
        method: 'POST',
        path: '/api/emails/send',
        headers: { 'x-csrf-token': token },
        cookies: { session_token: 'valid.jwt.token', csrf_token: token },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block mutating requests with mismatched CSRF token when session cookie is present', () => {
      const token = generateCsrfToken();
      const req: any = {
        method: 'POST',
        path: '/api/emails/send',
        headers: { 'x-csrf-token': 'wrong-token' },
        cookies: { session_token: 'valid.jwt.token', csrf_token: token },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow Bearer token authenticated API requests without CSRF cookie', () => {
      const req: any = {
        method: 'POST',
        path: '/api/emails/send',
        headers: { authorization: 'Bearer some-jwt-token' },
        cookies: {},
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('AES-256-GCM Token Encryption', () => {
    it('should encrypt and decrypt tokens accurately', () => {
      const rawToken = 'ya29.a0AfH6SMBx_Sample_Google_OAuth_Refresh_Token_12345';
      const encrypted = encrypt(rawToken);

      expect(encrypted).not.toEqual(rawToken);
      expect(encrypted.split(':')).toHaveLength(4); // version:iv:authTag:ciphertext

      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(rawToken);
    });

    it('should produce unique ciphertexts with different IVs for same plaintext', () => {
      const rawToken = 'sample_access_token_secret';
      const enc1 = encrypt(rawToken);
      const enc2 = encrypt(rawToken);

      expect(enc1).not.toEqual(enc2);
      expect(decrypt(enc1)).toEqual(rawToken);
      expect(decrypt(enc2)).toEqual(rawToken);
    });
  });
});
