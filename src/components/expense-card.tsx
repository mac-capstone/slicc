import { useRouter } from 'expo-router';
import React from 'react';

import { useExpense } from '@/api/expenses/use-expenses';
import {
  ActivityIndicator,
  Pressable,
  ProgressBar,
  Text,
  View,
} from '@/components/ui';
import { type ExpenseIdT } from '@/types';

type Props = {
  id: ExpenseIdT;
  config: 'progress' | 'compact' | 'withPic' | 'compactWithPic';
};

export const ExpenseCard = ({ id, config }: Props) => {
  const router = useRouter();

  const { data, isPending, isError } = useExpense({
    variables: id,
  });
  if (isPending) {
    return <ActivityIndicator />;
  }
  if (isError) {
    return <Text>Error loading expense</Text>;
  }
  const isThisYear =
    new Date(data.date).getFullYear() === new Date().getFullYear();
  const formattedDate = isThisYear
    ? new Date(data.date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : new Date(data.date).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
      });

  const totalAmount = data.totalAmount;
  const totalPaid = data.people.reduce((acc, person) => acc + person.paid, 0);
  const remainingAmount = Math.max(totalAmount - totalPaid, 0);
  const progressPercent =
    totalAmount > 0
      ? Math.min(Math.max((totalPaid / totalAmount) * 100, 0), 100)
      : 0;

  return (
    <Pressable
      className="flex-1"
      onPress={() => {
        router.push({
          pathname: `/expense/[id]`,
          params: { id, viewMode: 'view' },
        });
      }}
    >
      <View className="min-h-40 rounded-xl  bg-background-900 shadow-lg">
        <View className="flex flex-col justify-between gap-1 px-5 py-6">
          <View className="flex flex-row justify-between">
            <Text className="font-futuraBold text-xl text-text-50 dark:text-text-50">
              {data.name}
            </Text>
            <Text className="text-sm font-semibold dark:text-text-800">
              {formattedDate}
            </Text>
          </View>
          <View className="flex flex-row items-baseline gap-1 pt-1">
            <Text className="font-futuraBold text-xl dark:text-accent-100">
              ${remainingAmount.toFixed(2)}
            </Text>
            <Text className="text-sm font-medium text-text-800 dark:text-text-800">
              Remaining
            </Text>
          </View>
          <View className="flex flex-row items-center gap-1 pb-2">
            <Text className="text-sm font-medium text-text-800 dark:text-text-800">
              ${totalAmount.toFixed(2)}
            </Text>
            <Text className="text-sm font-medium text-text-800 dark:text-text-800">
              Total
            </Text>
          </View>
          {config === 'progress' && (
            <ProgressBar className="" initialProgress={progressPercent} />
          )}
        </View>
      </View>
    </Pressable>
  );
};
