import { useQueries } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { ExpenseIdT, UserIdT } from '@/types';

import {
  type ExpenseResponse,
  fetchExpense,
  useExpenseIds,
} from './use-expenses';

export function useBalances(userId: UserIdT | null) {
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

      if (!userId) {
        return {
          youOwe: 0,
          owedToYou: 0,
          isPending: pending,
          isError: hasError,
        };
      }

      let youOweTotal = 0;
      let owedToYouTotal = 0;

      for (const result of results) {
        const expense = result.data;
        if (!expense) continue;

        const isCreator = expense.createdBy === userId;
        const isParticipant = expense.people.some((p) => p.id === userId);

        if (!isParticipant && !isCreator) continue;

        for (const person of expense.people) {
          const remaining = Math.max(person.subtotal - (person.paid ?? 0), 0);

          if (person.id === userId) {
            youOweTotal += remaining;
          } else if (isCreator) {
            owedToYouTotal += remaining;
          }
        }
      }

      return {
        youOwe: youOweTotal,
        owedToYou: owedToYouTotal,
        isPending: pending,
        isError: hasError,
      };
    },
    [userId, idsPending]
  );

  const { youOwe, owedToYou, isPending, isError } = useQueries({
    queries: expenseIds.map((id) => ({
      queryKey: ['expenses', 'expenseId', id] as const,
      queryFn: () => fetchExpense(id as ExpenseIdT),
    })),
    combine,
  });

  return { youOwe, owedToYou, isPending, isError };
}
