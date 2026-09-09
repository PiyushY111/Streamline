import { safeFetch } from './client';
import { ProjectData, TaskData } from './types';

export async function fetchProjects(): Promise<ProjectData[]> {
  try {
    const res = await safeFetch('/projects', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.projects || [];
  } catch (err: unknown) {
    return [];
  }
}

export async function fetchProjectById(id: string): Promise<ProjectData | null> {
  try {
    const res = await safeFetch(`/projects/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.project || null;
  } catch (err: unknown) {
    return null;
  }
}

export async function createProjectApi(payload: Partial<ProjectData>): Promise<ProjectData> {
  const res = await safeFetch('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create project');
  const data = await res.json();
  return data.project;
}

export async function updateProjectApi(id: string, payload: Partial<ProjectData>): Promise<ProjectData> {
  const res = await safeFetch(`/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update project');
  const data = await res.json();
  return data.project;
}

export async function deleteProjectApi(id: string): Promise<void> {
  const res = await safeFetch(`/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function fetchProjectTasks(projectId: string): Promise<TaskData[]> {
  try {
    const res = await safeFetch(`/projects/${projectId}/tasks`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.tasks || [];
  } catch (err: unknown) {
    return [];
  }
}
