import { safeFetch } from './client';
import { TaskData } from './types';

export async function fetchTasks(): Promise<TaskData[]> {
  try {
    const res = await safeFetch('/tasks', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.tasks || [];
  } catch (err: unknown) {
    return [];
  }
}

export async function createTaskApi(payload: Partial<TaskData>): Promise<TaskData> {
  const res = await safeFetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create task');
  const data = await res.json();
  return data.task;
}

export async function updateTaskApi(id: string, payload: Partial<TaskData>): Promise<TaskData> {
  const res = await safeFetch(`/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update task');
  const data = await res.json();
  return data.task;
}

export async function deleteTaskApi(id: string): Promise<void> {
  const res = await safeFetch(`/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
}
