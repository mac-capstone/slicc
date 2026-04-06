import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { useExpense } from '@/api/expenses/use-expenses';
import { ActivityIndicator, colors, Text } from '@/components/ui';
import type { ExpenseIdT, UserIdT } from '@/types';

type Props = {
  expenseId: ExpenseIdT;
  userId: UserIdT | null;
};

export function PendingExpenseItem({ expenseId, userId }: Props) {
  const router = useRouter();
  const { data, isPending, isError } = useExpense({ variables: expenseId });

  if (isPending) return <ActivityIndicator size="small" />;
  if (isError || !data) return null;
  if (!userId) return null;

  const isCreator = data.createdBy === userId;
  const person = data.people.find((p) => p.id === userId);

  let youOwe = 0;
  let owedToYou = 0;

  if (person) {
    youOwe = Math.max(person.subtotal - (person.paid ?? 0), 0);
  }
  if (isCreator) {
    owedToYou = data.people
      .filter((p) => p.id !== userId)
      .reduce((sum, p) => sum + Math.max(p.subtotal - (p.paid ?? 0), 0), 0);
  }

  const hasYouOwe = youOwe > 0;
  const hasOwedToYou = owedToYou > 0;

  if (!hasYouOwe && !hasOwedToYou) return null;

  const label = hasYouOwe
    ? `$${youOwe.toFixed(2)}`
    : `$${owedToYou.toFixed(2)}`;
  const labelColor = hasYouOwe ? colors.danger[400] : colors.accent[100];

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: `/expense/[id]`,
          params: {
            id: expenseId,
            viewMode: 'view',
            ...(data.eventId ? { eventId: data.eventId } : {}),
          },
        })
      }
      className="flex-row items-center justify-between rounded-lg bg-background-900 px-4 py-3"
    >
      <Text
        className="flex-1 font-futuraMedium text-base"
        numberOfLines={1}
        style={{ color: colors.text[50] }}
      >
        {data.name}
      </Text>
      <Text className="font-futuraDemi text-sm" style={{ color: labelColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
