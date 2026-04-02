import { FlashList } from '@shopify/flash-list';
import { useQueries } from '@tanstack/react-query';
import React, { useMemo } from 'react';

import { fetchExpense, useExpenseIds } from '@/api/expenses/use-expenses';
import { DottedAddButton } from '@/components/dotted-add-button';
import { ExpenseCard } from '@/components/expense-card';
import { ActivityIndicator, Text, View } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { ExpenseIdT } from '@/types';

export default function Expenses() {
  const userId = useAuth.use.userId() ?? null;

  const {
    data: expenseIds = [],
    isPending: idsPending,
    isError: idsError,
  } = useExpenseIds();

  const queries = useMemo(
    () =>
      expenseIds.map((id) => ({
        queryKey: ['expenses', 'expenseId', id] as const,
        queryFn: () => fetchExpense(id as ExpenseIdT),
      })),
    [expenseIds]
  );

  const expenseQueries = useQueries({ queries });

  const filteredExpenseIds = useMemo(() => {
    if (!userId) return [];
    const expenses = expenseQueries
      .map((q) => q.data)
      .filter((e): e is NonNullable<typeof e> => e != null);

    return expenses
      .filter(
        (e) => e.createdBy === userId || e.people.some((p) => p.id === userId)
      )
      .map((e) => e.id);
  }, [expenseQueries, userId]);

  const isPending = idsPending || expenseQueries.some((q) => q.isPending);
  const isError = idsError || expenseQueries.some((q) => q.isError);
  if (isPending) {
    return <ActivityIndicator />;
  }
  if (isError) {
    return (
      <View className="flex-1 justify-center p-3">
        <Text>Error loading expenses</Text>
      </View>
    );
  }
  return (
    <View className="flex-1 px-3">
      <FlashList
        data={filteredExpenseIds}
        renderItem={({ item: expenseId }) => (
          <ExpenseCard id={expenseId} config="progress" />
        )}
        keyExtractor={(expenseId) => expenseId}
        ListEmptyComponent={
          <DottedAddButton text="Add new expense" path="/expense/add-expense" />
        }
        ListFooterComponent={
          filteredExpenseIds.length > 0 ? (
            <View className="pt-5">
              <DottedAddButton
                text="Add new expense"
                path="/expense/add-expense"
              />
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View className="h-5" />}
      />
    </View>
  );
}
