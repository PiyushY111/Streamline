import { safeFetch } from './client';
import { NextTaskResponse } from './types';

export async function fetchNextTask(options: {
  preset?: 'balanced' | 'deadline' | 'deep_work' | 'quick_wins';
  availableMinutes?: number;
  projectId?: string;
} = {}): Promise<NextTaskResponse | null> {
  try {
    const params = new URLSearchParams();
    if (options.preset) params.append('preset', options.preset);
    if (options.availableMinutes) params.append('availableMinutes', String(options.availableMinutes));
    if (options.projectId) params.append('projectId', options.projectId);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await safeFetch(`/planner/next${query}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch next task recommendation', err);
    return null;
  }
}

export async function fetchWeightPresets(): Promise<Record<string, any>> {
  try {
    const res = await safeFetch('/planner/presets', { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    return data.presets || {};
  } catch (err) {
    return {};
  }
}
