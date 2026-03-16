import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { ExpenseIdT, UserIdT } from '@/types';

import { fetchExpense, useExpenseIds } from './use-expenses';

function getRemainingAmount(expense: {
  totalAmount: number;
  people: { paid?: number }[];
}): number {
  const totalPaid = expense.people.reduce((acc, p) => acc + (p.paid ?? 0), 0);
  return Math.max(expense.totalAmount - totalPaid, 0);
}

export function usePendingExpenses(userId: UserIdT | null, limit = 5) {
  const { data: expenseIds = [], isPending: idsPending } = useExpenseIds();

  const expenseQueries = useQueries({
    queries: expenseIds.map((id) => ({
      queryKey: ['expenses', 'expenseId', id] as const,
      queryFn: () => fetchExpense(id as ExpenseIdT),
    })),
  });

  const pendingExpenseIds = useMemo(() => {
    const expenses = expenseQueries
      .map((q) => q.data)
      .filter((e): e is NonNullable<typeof e> => e != null);

    const userRelevant = userId
      ? expenses.filter(
          (e) => e.createdBy === userId || e.people.some((p) => p.id === userId)
        )
      : expenses;

    const withRemaining = userRelevant
      .map((expense) => ({
        id: expense.id,
        remaining: getRemainingAmount(expense),
        date: expense.date,
      }))
      .filter((e) => e.remaining > 0);

    const sorted = withRemaining.sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    return sorted.slice(0, limit).map((e) => e.id as ExpenseIdT);
  }, [expenseQueries, limit, userId]);

  const isPending = idsPending || expenseQueries.some((q) => q.isPending);
  const isError = expenseQueries.some((q) => q.isError);

  return {
    data: pendingExpenseIds,
    isPending,
    isError,
  };
}
