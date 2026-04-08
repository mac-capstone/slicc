import { useMutation, useQueries } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  applyCycleNetting,
  computeCycleNettingOps,
  type CycleNettingParams,
  mergeNettingOpsIntoExpense,
  type NettingOp,
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

type CycleNettingMutationContext = {
  previous: Record<string, ExpenseResponse | undefined>;
};

export function useCycleNetting() {
  return useMutation({
    mutationFn: applyCycleNetting,
    onMutate: async (
      params: CycleNettingParams
    ): Promise<CycleNettingMutationContext> => {
      const ops = computeCycleNettingOps(params);
      const byExpense = new Map<string, NettingOp[]>();
      for (const op of ops) {
        const list = byExpense.get(op.expenseId) ?? [];
        list.push(op);
        byExpense.set(op.expenseId, list);
      }

      await Promise.all(
        [...byExpense.keys()].map((id) =>
          queryClient.cancelQueries({
            queryKey: ['expenses', 'expenseId', id] as const,
          })
        )
      );

      const previous: Record<string, ExpenseResponse | undefined> = {};
      for (const [expenseId, expenseOps] of byExpense) {
        const key = ['expenses', 'expenseId', expenseId] as const;
        previous[expenseId] = queryClient.getQueryData<ExpenseResponse>(key);
        const base =
          previous[expenseId] ??
          params.expenses.find((e) => e.id === expenseId);
        if (base) {
          queryClient.setQueryData(
            key,
            mergeNettingOpsIntoExpense(base, expenseOps)
          );
        }
      }
      return { previous };
    },
    onError: (_err, _params, ctx) => {
      const p = ctx?.previous;
      if (!p) return;
      for (const [id, data] of Object.entries(p)) {
        if (data !== undefined) {
          queryClient.setQueryData(
            ['expenses', 'expenseId', id] as const,
            data
          );
        }
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
