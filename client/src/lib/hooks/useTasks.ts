'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTasks, createTaskApi, updateTaskApi, deleteTaskApi, TaskData } from '@/lib/api';
import { toast } from '@/components/ui/ToastProvider';

export function useTasks(filter?: string) {
  return useQuery({
    queryKey: ['tasks', filter || 'all'],
    queryFn: () => fetchTasks(),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<TaskData>) => createTaskApi(data),
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<TaskData[]>(['tasks', 'all']);

      const optimisticTask: TaskData = {
        id: `temp-${Date.now()}`,
        title: newTask.title || 'New Task',
        description: newTask.description,
        status: (newTask.status as any) || 'todo',
        priority: (newTask.priority as any) || 'medium',
        importance: newTask.importance ?? 0.5,
        estimatedMinutes: newTask.estimatedMinutes ?? null,
        dependencies: newTask.dependencies || [],
        dueAt: newTask.dueAt ? new Date(newTask.dueAt).toISOString() : undefined,
        completedAt: null,
        projectId: newTask.projectId || null,
        sourceEmailId: newTask.sourceEmailId,
        sourceEventId: newTask.sourceEventId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<TaskData[]>(['tasks', 'all'], (old = []) => [optimisticTask, ...old]);

      return { previousTasks };
    },
    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', 'all'], context.previousTasks);
      }
      toast.error(`Failed to create task: ${(err as Error).message}`);
    },
    onSuccess: () => {
      toast.success('Task created successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      updateTaskApi(id, {
        status: completed ? 'completed' : 'todo',
        completedAt: completed ? new Date().toISOString() : null,
      }),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<TaskData[]>(['tasks', 'all']);

      queryClient.setQueryData<TaskData[]>(['tasks', 'all'], (old = []) =>
        old.map((t) =>
          t.id === id
            ? {
                ...t,
                status: completed ? 'completed' : 'todo',
                completedAt: completed ? new Date().toISOString() : null,
              }
            : t,
        ),
      );

      return { previousTasks };
    },
    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', 'all'], context.previousTasks);
      }
      toast.error(`Failed to update task: ${(err as Error).message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTaskApi(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<TaskData[]>(['tasks', 'all']);

      queryClient.setQueryData<TaskData[]>(['tasks', 'all'], (old = []) => old.filter((t) => t.id !== id));

      return { previousTasks };
    },
    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', 'all'], context.previousTasks);
      }
      toast.error(`Failed to delete task: ${(err as Error).message}`);
    },
    onSuccess: () => {
      toast.success('Task deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
