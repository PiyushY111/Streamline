import { safeFetch } from './client';
import { AccountData } from './types';

export async function fetchConnectedAccounts(): Promise<AccountData[]> {
  try {
    const res = await safeFetch('/accounts', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.accounts || [];
  } catch (err: unknown) {
    return [];
  }
}

export async function updateAccountDetails(
  id: string,
  payload: { label?: string; color?: string },
): Promise<AccountData> {
  const res = await safeFetch(`/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update account');
  const data = await res.json();
  return data.account;
}

export async function disconnectAccountApi(id: string): Promise<void> {
  const res = await safeFetch(`/accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to disconnect account');
}
