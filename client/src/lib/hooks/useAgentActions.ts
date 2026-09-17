'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPendingActions, approvePendingAction, rejectPendingAction, PendingActionData } from '@/lib/api';
import { toast } from '@/components/ui/ToastProvider';

export function usePendingActions() {
  return useQuery({
    queryKey: ['pendingActions'],
    queryFn: () => fetchPendingActions(),
    staleTime: 30 * 1000,
  });
}

export function useApproveAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ actionId, idempotencyKey }: { actionId: string; idempotencyKey?: string }) =>
      approvePendingAction(actionId, idempotencyKey),
    onMutate: async ({ actionId }) => {
      await queryClient.cancelQueries({ queryKey: ['pendingActions'] });
      const previousActions = queryClient.getQueryData<PendingActionData[]>(['pendingActions']);

      // Optimistically remove approved action from pending list
      queryClient.setQueryData<PendingActionData[]>(['pendingActions'], (old = []) =>
        old.filter((a) => a.id !== actionId),
      );

      return { previousActions };
    },
    onError: (err, _variables, context) => {
      if (context?.previousActions) {
        queryClient.setQueryData(['pendingActions'], context.previousActions);
      }
      toast.error(`Approval failed: ${(err as Error).message}`);
    },
    onSuccess: () => {
      toast.success('Action executed successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingActions'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useRejectAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (actionId: string) => rejectPendingAction(actionId),
    onMutate: async (actionId) => {
      await queryClient.cancelQueries({ queryKey: ['pendingActions'] });
      const previousActions = queryClient.getQueryData<PendingActionData[]>(['pendingActions']);

      // Optimistically remove rejected action from pending list
      queryClient.setQueryData<PendingActionData[]>(['pendingActions'], (old = []) =>
        old.filter((a) => a.id !== actionId),
      );

      return { previousActions };
    },
    onError: (err, _variables, context) => {
      if (context?.previousActions) {
        queryClient.setQueryData(['pendingActions'], context.previousActions);
      }
      toast.error(`Rejection failed: ${(err as Error).message}`);
    },
    onSuccess: () => {
      toast.info('Action proposal dismissed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingActions'] });
    },
  });
}
