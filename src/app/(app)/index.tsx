import { FlashList } from '@shopify/flash-list';
import React from 'react';

import { useExpenseIds } from '@/api/expenses/use-expenses';
import { DottedAddButton } from '@/components/dotted-add-button';
import { ExpenseCard } from '@/components/expense-card';
import { ActivityIndicator, Text, View } from '@/components/ui';

export default function Feed() {
  const { data, isPending, isError } = useExpenseIds();
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
        data={data}
        renderItem={({ item: expenseId }) => (
          <ExpenseCard id={expenseId} config="progress" />
        )}
        keyExtractor={(expenseId) => expenseId}
        ListEmptyComponent={
          <DottedAddButton text="Add new expense" path="/expense/add-expense" />
        }
        ListFooterComponent={
          <View className="pt-5">
            <DottedAddButton
              text="Add new expense"
              path="/expense/add-expense"
            />
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-5" />} // 12px gap
      />
    </View>
  );
}
