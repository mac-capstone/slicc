import { useMutation, useQueries } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  applyCycleNetting,
  type CycleNettingParams,
} from '@/lib/expenses/apply-cycle-netting';
import {
  buildDebtEdges,
  collectNodeIds,
  type DebtEdge,
} from '@/lib/expenses/build-debt-edges';
import {
  type DetectedCycle,
  findDirectedCycle,
} from '@/lib/expenses/debt-graph-cycles';
import type { ExpenseIdT, UserIdT } from '@/types';

import { queryClient } from '../common/api-provider';
import {
  type ExpenseResponse,
  fetchExpense,
  useExpenseIds,
} from './use-expenses';

export type UseDebtGraphResult = {
  edges: DebtEdge[];
  nodeIds: UserIdT[];
  cycle: DetectedCycle | null;
  expenses: ExpenseResponse[];
  isPending: boolean;
  isError: boolean;
};

export function useDebtGraph(userId: UserIdT | null): UseDebtGraphResult {
  const { data: expenseIds = [], isPending: idsPending } = useExpenseIds();

  const combine = useCallback(
    (
      results: {
        data?: ExpenseResponse;
        isPending: boolean;
        isError: boolean;
      }[]
    ) => {
      const pending = idsPending || results.some((r) => r.isPending);
      const hasError = results.some((r) => r.isError);

      const expenses: ExpenseResponse[] = [];
      for (const r of results) {
        if (r.data) expenses.push(r.data);
      }

      const edges = buildDebtEdges(expenses, userId);
      const nodeIds = collectNodeIds(edges);
      const cycle = findDirectedCycle(edges);

      return {
        edges,
        nodeIds,
        cycle,
        expenses,
        isPending: pending,
        isError: hasError,
      };
    },
    [userId, idsPending]
  );

  return useQueries({
    queries: expenseIds.map((id) => ({
      queryKey: ['expenses', 'expenseId', id] as const,
      queryFn: () => fetchExpense(id as ExpenseIdT),
    })),
    combine,
  });
}

export function useCycleNetting() {
  return useMutation({
    mutationFn: async (params: CycleNettingParams) => {
      await applyCycleNetting(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });
}
