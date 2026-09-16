import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface KeyStore {
  activeVersion: string;
  keys: Record<string, Buffer>;
}

export function getKeyStore(): KeyStore {
  const activeVersion = env.ACTIVE_KEY_VERSION || 'v1';
  const keys: Record<string, Buffer> = {};

  if (env.ENCRYPTION_KEYS) {
    try {
      const parsed = JSON.parse(env.ENCRYPTION_KEYS);
      for (const [v, hex] of Object.entries(parsed)) {
        if (typeof hex === 'string' && hex.length === 64) {
          keys[v] = Buffer.from(hex, 'hex');
        }
      }
    } catch {
      // If parsing fails, proceed to fallback
    }
  }

  // Fallback: If active version or v1 key not in ENCRYPTION_KEYS, populate from primary ENCRYPTION_KEY
  if (!keys[activeVersion] && env.ENCRYPTION_KEY) {
    keys[activeVersion] = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  }
  if (!keys['v1'] && env.ENCRYPTION_KEY) {
    keys['v1'] = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  }

  return { activeVersion, keys };
}

/**
 * Encrypt plaintext using AES-256-GCM with the active key version (or version override).
 * Returns versioned format: `version:ivHex:authTagHex:ciphertextHex`
 */
export function encrypt(text: string, versionOverride?: string): string {
  const { activeVersion, keys } = getKeyStore();
  const version = versionOverride || activeVersion;
  const key = keys[version];
  if (!key) {
    throw new Error(`Encryption key for version "${version}" not found`);
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${version}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 * Supports both legacy 3-part format (`iv:authTag:ciphertext`, assumes 'v1')
 * and versioned 4-part format (`version:iv:authTag:ciphertext`).
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid encrypted data');
  }

  const { keys } = getKeyStore();
  const parts = encryptedData.split(':');

  let version = 'v1';
  let ivHex = '';
  let authTagHex = '';
  let encryptedText = '';

  if (parts.length === 3) {
    // Legacy unversioned format: iv:authTag:ciphertext
    ivHex = parts[0] ?? '';
    authTagHex = parts[1] ?? '';
    encryptedText = parts[2] ?? '';
  } else if (parts.length === 4) {
    // Versioned format: version:iv:authTag:ciphertext
    version = parts[0] ?? 'v1';
    ivHex = parts[1] ?? '';
    authTagHex = parts[2] ?? '';
    encryptedText = parts[3] ?? '';
  } else {
    throw new Error('Invalid encrypted token format');
  }

  if (!ivHex || !authTagHex || !encryptedText) {
    throw new Error('Invalid encrypted token components');
  }

  const key = keys[version];
  if (!key) {
    throw new Error(`Missing decryption key for version "${version}"`);
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Decrypts a token under its current key and re-encrypts under the target/active key version.
 * Enables zero-downtime background migration of persisted secrets.
 */
export function reencrypt(encryptedData: string, targetVersion?: string): string {
  const decrypted = decrypt(encryptedData);
  return encrypt(decrypted, targetVersion);
}
