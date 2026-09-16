import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../utils/encryption.js';

describe('AES-256-GCM Token Encryption Utility', () => {
  it('should encrypt plaintext tokens into formatted ciphertext with version header', () => {
    const secretToken = 'ya29.a0ARrdaM8x_SampleGoogleOAuthToken12345';
    const encrypted = encrypt(secretToken);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(secretToken);
    expect(encrypted.split(':')).toHaveLength(4); // version:iv:authTag:encryptedData
  });

  it('should accurately decrypt encrypted tokens back to original plaintext', () => {
    const originalToken = 'refresh_token_xyz_9876543210';
    const encrypted = encrypt(originalToken);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toEqual(originalToken);
  });

  it('should fail or throw error when decrypting invalid or tampered ciphertext', () => {
    expect(() => decrypt('invalid-token-string')).toThrow();
  });
});
