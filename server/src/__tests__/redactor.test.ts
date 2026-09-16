import { describe, it, expect } from 'vitest';
import { scrubString, redactSecrets } from '../utils/redactor.js';

describe('Phase 6: Secret & PII Redactor Security Suite (redactor.ts)', () => {
  describe('scrubString()', () => {
    it('scrubs Google Gemini API keys starting with AIza', () => {
      const raw = 'Calling Gemini with key AIzaSyD4f8Gh7jKl9Mn0Pq1Rs2Tu3Vw4Xy5Z6_a';
      const scrubbed = scrubString(raw);
      expect(scrubbed).not.toContain('AIzaSyD4f8Gh7jKl9Mn0Pq1Rs2Tu3Vw4Xy5Z6_a');
      expect(scrubbed).toContain('[REDACTED_GOOGLE_API_KEY]');
    });

    it('scrubs OpenAI API keys starting with sk-', () => {
      const raw = 'Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz1234567890';
      const scrubbed = scrubString(raw);
      expect(scrubbed).not.toContain('sk-abcdefghijklmnopqrstuvwxyz1234567890');
      expect(scrubbed).toContain('[REDACTED_OPENAI_API_KEY]');
    });

    it('scrubs Anthropic API keys starting with sk-ant-', () => {
      const raw = 'Anthropic key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789_xyz';
      const scrubbed = scrubString(raw);
      expect(scrubbed).not.toContain('sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789_xyz');
      expect(scrubbed).toContain('[REDACTED_ANTHROPIC_API_KEY]');
    });

    it('scrubs Bearer tokens from authorization strings', () => {
      const raw = 'Header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9.sig';
      const scrubbed = scrubString(raw);
      expect(scrubbed).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(scrubbed).toContain('Bearer [REDACTED_BEARER_TOKEN]');
    });

    it('scrubs database connection strings with embedded credentials', () => {
      const pgUrl = 'postgres://admin:SuperSecretPass123!@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require';
      const scrubbed = scrubString(pgUrl);
      expect(scrubbed).not.toContain('SuperSecretPass123!');
      expect(scrubbed).toContain('postgres://[REDACTED_USER_PASSWORD]@[REDACTED_HOST]');

      const mongoUrl = 'mongodb://root:SecretDbPassword@cluster0.mongodb.net/test';
      const mongoScrubbed = scrubString(mongoUrl);
      expect(mongoScrubbed).not.toContain('SecretDbPassword');
      expect(mongoScrubbed).toContain('mongodb://[REDACTED_USER_PASSWORD]@[REDACTED_HOST]');
    });

    it('scrubs private RSA and SSH keys', () => {
      const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+abcdefghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----`;
      const scrubbed = scrubString(privateKey);
      expect(scrubbed).not.toContain('MIIEowIBAAKCAQEA0Y1+');
      expect(scrubbed).toBe('[REDACTED_PRIVATE_KEY]');
    });
  });

  describe('redactSecrets() on Deep Objects and JSON Payloads', () => {
    it('redacts sensitive fields in nested object structures', () => {
      const payload = {
        userId: 'user-123',
        account: {
          email: 'user@example.com',
          accessToken: 'ya29.a0AfH6SMD_sensitive_token_here',
          refreshToken: '1//0gSensitiveRefreshToken',
          clientSecret: 'GOCSPX-secret-value-123',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
          apiKey: 'AIzaSyD4f8Gh7jKl9Mn0Pq1Rs2Tu3Vw4Xy5Z6_a',
        },
        metadata: {
          provider: 'google',
          dbUri: 'postgres://app:myPass@neon.tech/streamline',
        },
      };

      const redacted = redactSecrets(payload);

      expect(redacted.userId).toBe('user-123');
      expect(redacted.account.accessToken).toBe('[REDACTED_CREDENTIAL]');
      expect(redacted.account.refreshToken).toBe('[REDACTED_CREDENTIAL]');
      expect(redacted.account.clientSecret).toBe('[REDACTED_CREDENTIAL]');
      expect(redacted.account.apiKey).toBe('[REDACTED_CREDENTIAL]');
      expect(redacted.metadata.dbUri).toContain('[REDACTED_USER_PASSWORD]');
    });

    it('handles arrays, primitives, and null/undefined values gracefully', () => {
      expect(redactSecrets(null)).toBeNull();
      expect(redactSecrets(undefined)).toBeUndefined();
      expect(redactSecrets(42)).toBe(42);
      expect(redactSecrets(true)).toBe(true);

      const arrayData = ['AIzaSyD4f8Gh7jKl9Mn0Pq1Rs2Tu3Vw4Xy5Z6_a', { token: 'secret-123', name: 'valid-task' }];
      const redactedArray = redactSecrets(arrayData) as [string, { token: string; name: string }];
      expect(redactedArray[0]).toBe('[REDACTED_GOOGLE_API_KEY]');
      expect(redactedArray[1].token).toBe('[REDACTED_CREDENTIAL]');
      expect(redactedArray[1].name).toBe('valid-task');
    });

    it('prevents cyclic recursion stack overflow when object has deep nesting', () => {
      const deepObj: any = { level: 0 };
      let curr = deepObj;
      for (let i = 1; i <= 20; i++) {
        curr.child = { level: i, token: `secret-${i}` };
        curr = curr.child;
      }

      expect(() => redactSecrets(deepObj)).not.toThrow();
    });
  });
});
