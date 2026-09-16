import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Authentication & Password Hashing Unit Tests', () => {
  it('should hash passwords with bcrypt cost factor 10', async () => {
    const rawPassword = 'SecurePassword123!';
    const hash = await bcrypt.hash(rawPassword, 10);

    expect(hash).toBeDefined();
    expect(hash).not.toEqual(rawPassword);

    const isValid = await bcrypt.compare(rawPassword, hash);
    expect(isValid).toBe(true);
  });

  it('should reject invalid password match', async () => {
    const hash = await bcrypt.hash('CorrectPassword', 10);
    const isValid = await bcrypt.compare('WrongPassword', hash);

    expect(isValid).toBe(false);
  });

  it('should sign and verify JWT session tokens cleanly', () => {
    const secret = 'test-secret-key-123456789';
    const payload = { id: 'usr-100', email: 'test@example.com' };

    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    expect(token).toBeDefined();

    const decoded = jwt.verify(token, secret) as { id: string; email: string };
    expect(decoded.id).toEqual(payload.id);
    expect(decoded.email).toEqual(payload.email);
  });
});
