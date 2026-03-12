import { AntDesign } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { queryClient } from '@/api/common/api-provider';
import { useExpense } from '@/api/expenses/use-expenses';
import { useItem } from '@/api/items/use-items';
import { usePeopleIdsForItem } from '@/api/people/use-people';
import { calculatePersonShare } from '@/lib';
import { useExpenseCreation } from '@/lib/store';
import { type ExpenseIdT, type ItemIdT } from '@/types';

import { PersonAvatar } from './person-avatar';
import { Button } from './ui/button';

type Props = {
  expenseId: ExpenseIdT;
  itemId: ItemIdT;
};

export const ItemCardDetailed = ({ expenseId, itemId }: Props) => {
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const updateItemShare = useExpenseCreation.use.updateItemShare();
  const removePersonFromItem = useExpenseCreation.use.removePersonFromItem();

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
  });

  const {
    data: expense,
    isPending: isExpensePending,
    isError: isExpenseError,
  } = useExpense({
    variables: expenseId,
  });

  const isPending = isItemPending || isAssignedIdsPending || isExpensePending;
  const isError = isItemError || isAssignedIdsError || isExpenseError;

  useEffect(() => {
    const updateItemShares = async () => {
      if (
        splitMode === 'equal' &&
        assignedPersonIds &&
        assignedPersonIds.length > 0
      ) {
        assignedPersonIds.forEach((pid) => {
          updateItemShare(itemId, pid, 1);
        });
        await queryClient.invalidateQueries({
          queryKey: useItem.getKey({
            expenseId,
            itemId,
          }),
        });
      }
    };
    updateItemShares();
  }, [splitMode, assignedPersonIds, itemId, updateItemShare, expenseId]);

  if (isPending) {
    return <ActivityIndicator />;
  }

  if (isError) {
    return <Text>Error loading item</Text>;
  }

  // Only check item and expense - assignedPersonIds can be empty array
  if (!item || !expense) {
    return null;
  }

  const { name: itemName, amount: itemPrice } = item;
  const people = expense.people; // never undefined as we use temp expenses which has people

  // Default to empty array to prevent undefined rendering
  const ids = (assignedPersonIds ?? []) as string[];
  const assignedPeople = people?.filter((p) => ids.includes(p.id)) ?? [];

  const handleIncrease = async (personId: string) => {
    const currentShare = item.split.shares[personId] || 0;
    const newShare = parseFloat((currentShare + 1).toFixed(1));
    updateItemShare(itemId, personId, newShare);
    await queryClient.invalidateQueries({
      queryKey: useItem.getKey({
        expenseId,
        itemId,
      }),
    });
  };

  const handleDecrease = async (personId: string) => {
    const currentShare = item.split.shares[personId] || 0;
    const newShare = parseFloat(Math.max(0, currentShare - 1).toFixed(1));
    updateItemShare(itemId, personId, newShare);
    await queryClient.invalidateQueries({
      queryKey: useItem.getKey({
        expenseId,
        itemId,
      }),
    });
  };

  const participants = assignedPeople.map((person) => {
    const share = item.split.shares[person.id] || 0;
    const price = calculatePersonShare(item, person.id);
    return {
      ...person,
      quantity: share,
      price: `$${price.toFixed(2)}`,
    };
  });

  return (
    <View className="w-full overflow-hidden rounded-xl bg-neutral-800 p-4 shadow-lg">
      {/* Top section */}
      <View className="flex-row items-center justify-between">
        <View className="w-9/12 flex-row items-center gap-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row"
          >
            {assignedPeople.map((person, index: number) => (
              <View key={person.id} className={index > 0 ? '-ml-3' : 'm-0'}>
                <PersonAvatar size="lg" />
              </View>
            ))}
          </ScrollView>
          {assignedPeople.length > 0 && (
            <Pressable
              onPress={async () => {
                assignedPeople.forEach((person) => {
                  removePersonFromItem(itemId, person.id);
                });
                await queryClient.invalidateQueries({
                  queryKey: usePeopleIdsForItem.getKey({
                    expenseId,
                    itemId,
                  }),
                });
                await queryClient.invalidateQueries({
                  queryKey: useItem.getKey({
                    expenseId,
                    itemId,
                  }),
                });
              }}
            >
              <AntDesign name="close" size={12} color="red" />
            </Pressable>
          )}
        </View>
        <Button
          label={splitMode === 'equal' ? 'Equal' : '$ Custom'}
          variant="outline"
          size="sm"
          onPress={() =>
            setSplitMode(splitMode === 'equal' ? 'custom' : 'equal')
          }
        />
      </View>

      {/* Item details */}
      <View className="pt-4">
        <Text className="font-futuraDemi text-3xl dark:text-text-50">
          {itemName}
        </Text>
        <Text className="text-lg dark:text-accent-100">{`$${itemPrice.toFixed(
          2
        )}`}</Text>
      </View>

      {/* Participants */}
      <View className="pt-4">
        {splitMode === 'custom' && participants.length > 0 && (
          <ScrollView className="max-h-40">
            {participants.map((participant, index: number) => {
              if (!participant) {
                return null;
              }
              return (
                <View
                  key={index}
                  className="flex-row items-center justify-between py-2"
                >
                  <Text className="text-lg text-white">{participant.name}</Text>
                  <View className="flex-row items-center p-1">
                    <Pressable onPress={() => handleDecrease(participant.id)}>
                      <AntDesign name="minus" size={16} color="white" />
                    </Pressable>
                    <View className="mx-4 min-h-8 min-w-8 items-center justify-center rounded-md bg-white px-2 py-1">
                      <Text className="text-md font-bold text-black">
                        {participant.quantity}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleIncrease(participant.id)}>
                      <AntDesign name="plus" size={16} color="white" />
                    </Pressable>
                    <Text
                      className={
                        participant.price.length > 6
                          ? 'ml-5 w-auto text-right text-lg text-white'
                          : 'ml-5 w-20 text-right text-lg text-white'
                      }
                    >
                      {participant.price}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
};
