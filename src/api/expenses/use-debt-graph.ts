import { useMutation, useQueries } from '@tanstack/react-query';
import { useCallback } from 'react';

import { queryClient } from '@/api/common/api-provider';
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
  const {
    data: expenseIds = [],
    isPending: idsPending,
    isError: idsError,
  } = useExpenseIds();

  const combine = useCallback(
    (
      results: {
        data?: ExpenseResponse;
        isPending: boolean;
        isError: boolean;
      }[]
    ) => {
      const pending = idsPending || results.some((r) => r.isPending);
      const hasError = idsError || results.some((r) => r.isError);

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
    [userId, idsPending, idsError]
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
  hadData: Record<string, boolean>;
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

      const previous: Record<string, ExpenseResponse | undefined> = {};
      const hadData: Record<string, boolean> = {};

      for (const [expenseId, expenseOps] of byExpense) {
        const key = ['expenses', 'expenseId', expenseId] as const;
        await queryClient.cancelQueries({ queryKey: key });
        const cached = queryClient.getQueryData<ExpenseResponse>(key);
        previous[expenseId] = cached;
        hadData[expenseId] = cached !== undefined;
        const base = cached ?? params.expenses.find((e) => e.id === expenseId);
        if (base) {
          queryClient.setQueryData(
            key,
            mergeNettingOpsIntoExpense(base, expenseOps)
          );
        }
      }
      return { previous, hadData };
    },
    onError: (_err, _params, ctx) => {
      if (!ctx) return;
      const { previous, hadData } = ctx;
      for (const id of Object.keys(previous)) {
        const key = ['expenses', 'expenseId', id] as const;
        if (hadData[id]) {
          queryClient.setQueryData(key, previous[id]);
        } else {
          queryClient.removeQueries({ queryKey: key });
        }
      }
    },
    onSuccess: (result) => {
      for (const id of result.affectedExpenseIds) {
        void queryClient.invalidateQueries({
          queryKey: ['expenses', 'expenseId', id] as const,
        });
      }
    },
  });
}
