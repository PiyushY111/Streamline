import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { encrypt, decrypt, reencrypt, getKeyStore } from '../utils/encryption.js';
import { env } from '../config/env.js';

describe('AES-256-GCM Key Rotation & Backward Compatibility', () => {
  const originalEnvKeys = env.ENCRYPTION_KEYS;
  const originalActiveVersion = env.ACTIVE_KEY_VERSION;

  const keyV1 = env.ENCRYPTION_KEY;
  const keyV2 = crypto.randomBytes(32).toString('hex');
  const keyV3 = crypto.randomBytes(32).toString('hex');

  afterEach(() => {
    env.ENCRYPTION_KEYS = originalEnvKeys;
    env.ACTIVE_KEY_VERSION = originalActiveVersion;
  });

  it('should encrypt with active version v1 by default in 4-part format', () => {
    const plaintext = 'oauth-secret-access-token-12345';
    const encrypted = encrypt(plaintext);

    const parts = encrypted.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should seamlessly decrypt legacy 3-part payloads (iv:authTag:ciphertext)', () => {
    const rawPlaintext = 'legacy-unversioned-refresh-token';
    const keyBuffer = Buffer.from(keyV1, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    let ciphertext = cipher.update(rawPlaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // Legacy format without version prefix
    const legacyPayload = `${iv.toString('hex')}:${authTag}:${ciphertext}`;
    expect(legacyPayload.split(':')).toHaveLength(3);

    const decrypted = decrypt(legacyPayload);
    expect(decrypted).toBe(rawPlaintext);
  });

  it('should support multiple key versions in ENCRYPTION_KEYS JSON and rotate active version', () => {
    // Configure multi-key store
    env.ENCRYPTION_KEYS = JSON.stringify({
      v1: keyV1,
      v2: keyV2,
      v3: keyV3,
    });
    env.ACTIVE_KEY_VERSION = 'v2';

    const plaintext = 'rotated-key-token-payload';

    // Encrypt with v2
    const encryptedV2 = encrypt(plaintext);
    expect(encryptedV2.startsWith('v2:')).toBe(true);
    expect(decrypt(encryptedV2)).toBe(plaintext);

    // Can also encrypt with explicit v1 or v3
    const encryptedV1 = encrypt(plaintext, 'v1');
    expect(encryptedV1.startsWith('v1:')).toBe(true);
    expect(decrypt(encryptedV1)).toBe(plaintext);

    const encryptedV3 = encrypt(plaintext, 'v3');
    expect(encryptedV3.startsWith('v3:')).toBe(true);
    expect(decrypt(encryptedV3)).toBe(plaintext);
  });

  it('should re-encrypt tokens from older key versions to active/target key version', () => {
    env.ENCRYPTION_KEYS = JSON.stringify({
      v1: keyV1,
      v2: keyV2,
    });
    env.ACTIVE_KEY_VERSION = 'v1';

    const plaintext = 'token-to-be-migrated-to-v2';
    const initialV1Payload = encrypt(plaintext, 'v1');
    expect(initialV1Payload.startsWith('v1:')).toBe(true);

    // Re-encrypt to v2
    const reencryptedPayload = reencrypt(initialV1Payload, 'v2');
    expect(reencryptedPayload.startsWith('v2:')).toBe(true);
    expect(reencryptedPayload).not.toBe(initialV1Payload);

    // Verify decrypted content matches original
    expect(decrypt(reencryptedPayload)).toBe(plaintext);
  });

  it('should throw when decrypting with a missing key version', () => {
    env.ENCRYPTION_KEYS = JSON.stringify({
      v1: keyV1,
    });
    const fakeV9Payload = `v9:${crypto.randomBytes(12).toString('hex')}:${crypto.randomBytes(16).toString('hex')}:deadbeef`;
    expect(() => decrypt(fakeV9Payload)).toThrow(/Missing decryption key for version "v9"/);
  });

  it('should throw when ciphertext or auth tag is corrupted or tampered', () => {
    const encrypted = encrypt('sensitive-bank-grade-data');
    const parts = encrypted.split(':');
    // Tamper with ciphertext
    const ct = parts[3] ?? 'deadbeef';
    parts[3] = ct.slice(0, -2) + (ct.endsWith('a') ? 'b' : 'a');
    const tampered = parts.join(':');

    expect(() => decrypt(tampered)).toThrow();
  });
});
