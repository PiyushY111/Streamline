import { describe, it, expect, vi } from 'vitest';
import { accountsRepository } from '../repositories/accounts.repository.js';
import { db } from '../db/index.js';

describe('Accounts Repository Security & Sanitization', () => {
  it('should guarantee public findByUserId excludes accessToken and refreshToken', async () => {
    vi.spyOn(db, 'select').mockImplementation((fields: any) => {
      // Check that selected fields do NOT include accessToken or refreshToken
      if (fields) {
        expect(fields.accessToken).toBeUndefined();
        expect(fields.refreshToken).toBeUndefined();
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'acc-1',
            providerAccountId: 'google-101',
            email: 'test@gmail.com',
            label: 'Personal Mail',
            color: '#3b82f6',
            status: 'active',
          },
        ]),
      } as any;
    });

    const accounts = await accountsRepository.findByUserId('user-1');
    expect(accounts).toHaveLength(1);
    expect((accounts[0] as any).accessToken).toBeUndefined();
    expect((accounts[0] as any).refreshToken).toBeUndefined();
  });

  it('should guarantee public findById excludes sensitive credentials', async () => {
    vi.spyOn(db, 'select').mockImplementation((fields: any) => {
      if (fields) {
        expect(fields.accessToken).toBeUndefined();
        expect(fields.refreshToken).toBeUndefined();
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'acc-1',
            email: 'test@gmail.com',
            status: 'active',
          },
        ]),
      } as any;
    });

    const account = await accountsRepository.findById('acc-1');
    expect(account).toBeDefined();
    expect((account as any)?.accessToken).toBeUndefined();
    expect((account as any)?.refreshToken).toBeUndefined();
  });
});
