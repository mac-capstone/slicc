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

        // The expense owner is whoever paid for the expense (falls back to creator)
        const payerId = expense.payerUserId ?? expense.createdBy ?? null;
        const isPayer = payerId === userId;
        const isParticipant = expense.people.some((p) => p.id === userId);

        if (!isParticipant && !isPayer) continue;

        if (isPayer) {
          // As payer: sum what each non-payer person still owes you
          for (const person of expense.people) {
            if (person.id === userId) continue; // own items are already covered
            const remaining = Math.max(person.subtotal - (person.paid ?? 0), 0);
            owedToYouTotal += remaining;
          }
        } else if (isParticipant) {
          // As a non-payer participant: add your own remaining share to youOwe
          const self = expense.people.find((p) => p.id === userId);
          if (self) {
            const remaining = Math.max(self.subtotal - (self.paid ?? 0), 0);
            youOweTotal += remaining;
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
