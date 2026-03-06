import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { queryClient } from '@/api/common/api-provider';
import { useExpense } from '@/api/expenses/use-expenses';
import { useItem } from '@/api/items/use-items';
import { usePeopleIdsForItem } from '@/api/people/use-people';
import { colors } from '@/components/ui';
import { useExpenseCreation } from '@/lib/store';
import {
  type ExpenseIdT,
  type ItemIdT,
  type PersonIdT,
  type PersonWithId,
} from '@/types';

import { PersonAvatar } from './person-avatar';

type Props = {
  itemID: ItemIdT;
  expenseId: ExpenseIdT;
};

const MAX_PEOPLE = 16;

export const AddRemovePerson = ({ itemID, expenseId }: Props) => {
  const {
    data: tempExpense,
    isPending,
    isError,
  } = useExpense({
    variables: expenseId,
  });

  const {
    data: assignedPeopleIds,
    isPending: isAssignedPending,
    isError: isAssignedError,
  } = usePeopleIdsForItem({
    variables: { expenseId, itemId: itemID },
  });

  const { assignPersonToItem, removePersonFromItem, addPerson, removePerson } =
    useExpenseCreation();

  if (isPending || isAssignedPending) {
    return <ActivityIndicator />;
  }

  if (isError || isAssignedError) {
    return <Text>Error loading temp expense</Text>;
  }

  const handleAddPerson = async () => {
    if (maxPeopleReached) return;
    const peopleArray = tempExpense?.people || [];
    const avatarColors = Object.keys(colors.avatar || {});
    const newPerson: PersonWithId = {
      id: uuidv4() as PersonIdT,
      name: `Person ${peopleArray.length + 1}`,
      color: avatarColors[peopleArray.length % avatarColors.length],
      userRef: null,
      subtotal: 0,
      paid: 0,
    };
    addPerson(newPerson);
    await queryClient.invalidateQueries({
      queryKey: ['expenses', 'expenseId', expenseId],
    });
  };

  const handleRemove = async () => {
    if (!tempExpense) return;
    assignedPeopleIds.forEach((personId) => {
      removePersonFromItem(itemID, personId);
      removePerson(personId);
    });
    await queryClient.invalidateQueries({
      queryKey: ['people', 'expenseId', expenseId, 'itemId', itemID],
    });
    await queryClient.invalidateQueries({
      queryKey: ['expenses', 'expenseId', expenseId],
    });
  };

  const people = tempExpense?.people ?? [];
  const maxPeopleReached = people.length >= MAX_PEOPLE;

  return (
    <View className="bg-transparent p-4">
      <Text className="pb-2 text-sm text-gray-400">
        {itemID ? 'Tap to assign to item' : 'Select an item to assign people'}
      </Text>
      <View className="flex-row flex-wrap items-center pb-4">
        {people.map((person) => {
          const isAssigned = itemID && assignedPeopleIds.includes(person.id);
          return (
            <TouchableOpacity
              key={person.id}
              onPress={async () => {
                if (!itemID) return;
                if (isAssigned) {
                  removePersonFromItem(itemID, person.id);
                } else {
                  assignPersonToItem(itemID, person.id);
                }
                await queryClient.invalidateQueries({
                  queryKey: usePeopleIdsForItem.getKey({
                    expenseId,
                    itemId: itemID,
                  }),
                });
                await queryClient.invalidateQueries({
                  queryKey: useItem.getKey({
                    expenseId,
                    itemId: itemID,
                  }),
                });
              }}
              className="pb-2 pr-1"
              activeOpacity={1}
              disabled={!itemID}
            >
              <PersonAvatar
                size="lg"
                personId={person.id}
                expenseId={expenseId}
                inSplitView={true}
                isSelected={isAssigned}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="flex-row justify-between pb-4">
        <TouchableOpacity
          className="bg-background-800 mr-2 flex-1 items-center rounded-lg border border-text-900 p-3"
          onPress={handleAddPerson}
          activeOpacity={1}
        >
          <Text
            className={
              maxPeopleReached
                ? 'font-bold text-gray-500'
                : 'font-bold text-white'
            }
          >
            Add person
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-background-800 ml-2 flex-1 items-center rounded-lg border border-text-900 p-3"
          onPress={handleRemove}
          disabled={assignedPeopleIds.length === 0}
        >
          <Text
            className={`font-bold ${
              assignedPeopleIds.length > 0 ? 'text-white' : 'text-gray-500'
            }`}
          >
            Remove
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
