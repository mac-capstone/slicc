import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useExpense } from '@/api/expenses/use-expenses';
import { useItem } from '@/api/items/use-items';
import { usePeopleIdsForItem } from '@/api/people/use-people';
import { ActivityIndicator } from '@/components/ui';
import { type ExpenseIdT, type ItemIdT, type UserIdT } from '@/types';

import { PersonAvatar } from './person-avatar';

type Props = {
  expenseId: ExpenseIdT;
  itemId: ItemIdT;
  onPress?: (itemId: ItemIdT) => void;
  selected?: boolean;
  mode?: 'compact' | 'normal';
};

export const ItemCard = ({
  expenseId,
  itemId,
  onPress,
  selected,
  mode = 'normal',
}: Props) => {
  const {
    data: item,
    isPending: isItemPending,
    isError: isItemError,
  } = useItem({
    variables: { expenseId, itemId },
  });

  const {
    data: assignedPersonIds,
    isPending: isAssignedIdsPending,
    isError: isAssignedIdsError,
  } = usePeopleIdsForItem({
    variables: { expenseId, itemId },
    enabled: mode === 'compact',
  });

  const {
    data: expense,
    isPending: isExpensePending,
    isError: isExpenseError,
  } = useExpense({
    variables: expenseId,
    enabled: mode === 'compact',
  });

  const isPending =
    isItemPending ||
    (mode === 'compact' && (isAssignedIdsPending || isExpensePending));
  const isError =
    isItemError ||
    (mode === 'compact' && (isAssignedIdsError || isExpenseError));

  if (isPending) {
    return <ActivityIndicator />;
  }

  if (isError || !item) {
    return <Text>Error loading item</Text>;
  }

  if (mode === 'compact') {
    if (!expense) {
      return null;
    }

    const people = expense.people;
    const ids = (assignedPersonIds ?? []) as string[];
    const assignedPeople = people?.filter((p) => ids.includes(p.id)) ?? [];

    return (
      <Pressable
        onPress={() => onPress?.(itemId)}
        className={`w-full flex-row items-center justify-between rounded-xl border p-6 ${
          selected
            ? 'border-accent-100 bg-accent-900'
            : 'border-transparent bg-background-900'
        }`}
      >
        <View className="flex-1 flex-row items-center gap-3">
          {assignedPeople.length > 0 && (
            <View className="flex-row items-center">
              {assignedPeople.slice(0, 4).map((person, index: number) => (
                <View key={person.id} className={index > 0 ? '-ml-3' : ''}>
                  <PersonAvatar
                    userId={person.id as UserIdT}
                    fallbackLabel={person.name}
                    size="md"
                  />
                </View>
              ))}
              {assignedPeople.length > 4 && (
                <Text className="ml-2 text-lg dark:text-text-50">···</Text>
              )}
            </View>
          )}
          <View className="flex-1 flex-row items-center justify-between">
            <Text className="font-futuraDemi text-2xl dark:text-text-50">
              {item.name}
            </Text>
            <Text className="font-futuraMedium text-2xl dark:text-text-50">
              ${(item.amount * (1 + item.taxRate / 100)).toFixed(2)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  // Normal mode
  return (
    <View key={item.id} className="h-24 rounded-xl bg-background-900 px-5 py-4">
      <View className="flex flex-row items-center justify-between">
        <Text className="font-futuraMedium text-xl dark:text-text-50">
          {item.name}
        </Text>
        <Text className="font-futuraDemi text-xl dark:text-text-50">
          ${(item.amount * (1 + item.taxRate / 100)).toFixed(2)}
        </Text>
      </View>
      <View className="flex flex-row items-center justify-start gap-2 pt-2">
        {item.assignedPersonIds.map((personId) => (
          <PersonAvatar key={personId} userId={personId as UserIdT} size="md" />
        ))}
      </View>
    </View>
  );
};
