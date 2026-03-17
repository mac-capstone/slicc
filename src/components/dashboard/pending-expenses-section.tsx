import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { PendingExpenseItem } from '@/components/dashboard/pending-expense-item';
import { ActivityIndicator, colors, Text, View } from '@/components/ui';
import type { ExpenseIdT, UserIdT } from '@/types';

type Props = {
  expenseIds: ExpenseIdT[];
  userId: UserIdT | null;
  isPending: boolean;
  isError: boolean;
};

export function PendingExpensesSection({
  expenseIds,
  userId,
  isPending,
  isError,
}: Props) {
  const router = useRouter();

  if (isPending) {
    return (
      <View className="py-4">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="py-4">
        <Text className="text-center" style={{ color: colors.text[800] }}>
          Error loading expenses
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-futuraDemi text-lg">Pending Expenses</Text>
        <Pressable
          onPress={() => router.push('/expenses')}
          accessibilityLabel="See all expenses"
          accessibilityRole="button"
        >
          <Text className="text-sm" style={{ color: colors.accent[100] }}>
            See all
          </Text>
        </Pressable>
      </View>
      {expenseIds.length === 0 ? (
        <Text className="py-4 text-center" style={{ color: colors.text[800] }}>
          No pending expenses
        </Text>
      ) : (
        <View className="gap-2">
          {expenseIds.map((id) => (
            <PendingExpenseItem key={id} expenseId={id} userId={userId} />
          ))}
        </View>
      )}
    </View>
  );
}
