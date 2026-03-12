import { FlashList } from '@shopify/flash-list';
import React from 'react';

import { usePersonItems } from '@/api/items/use-person-items';
import { usePerson } from '@/api/people/use-people';
import { useUser } from '@/api/people/use-users';
import { ActivityIndicator, Text, View } from '@/components/ui';
import { calculatePersonShare } from '@/lib/utils';
import { type ExpenseIdT, type PersonIdT, type UserIdT } from '@/types';

import { PersonAvatar } from './person-avatar';
export const PersonCard = ({
  personId,
  expenseId,
}: {
  personId: UserIdT;
  expenseId: ExpenseIdT;
}) => {
  const {
    data,
    isPending: isPersonPending,
    isError: isPersonError,
  } = usePerson({
    variables: { expenseId, personId },
  });
  const {
    data: personItems,
    isPending: isItemsPending,
    isError: isItemsError,
  } = usePersonItems({
    variables: { expenseId, personId },
  });
  const { data: user } = useUser({ variables: personId });

  if (isPersonPending || isItemsPending) {
    return <ActivityIndicator />;
  }
  if (isPersonError || isItemsError || !data || !personItems) {
    return <Text>Error loading person</Text>;
  }
  const subtotal = personItems.reduce((sum, item) => {
    const share = calculatePersonShare(item, personId);
    return Number.isFinite(share) ? sum + share : sum;
  }, 0);
  return (
    <View className="flex min-h-20 w-full flex-col gap-2 rounded-xl bg-background-900 p-3">
      <View className="flex w-full flex-row justify-between gap-2">
        <View className="flex flex-row items-center gap-2">
          <PersonAvatar userId={personId} size="lg" />
          <Text className="font-futuraMedium text-xl dark:text-text-50">
            {user?.displayName ?? 'Unknown'}
          </Text>
        </View>
        <Text className="font-futuraDemi text-xl dark:text-accent-100">
          ${subtotal.toFixed(2)}
        </Text>
      </View>
      <View className="ml-6 mt-1 border-l border-white/15 pl-4">
        <PersonItemList personId={personId} expenseId={expenseId} />
      </View>
    </View>
  );
};

export const PersonItemList = ({
  personId,
  expenseId,
}: {
  personId: UserIdT;
  expenseId: ExpenseIdT;
}) => {
  const pid = personId as unknown as PersonIdT;
  const { data, isPending, isError } = usePersonItems({
    variables: { expenseId, personId: pid },
  });
  if (isPending) {
    return <ActivityIndicator />;
  }
  if (isError) {
    return <Text>Error loading items</Text>;
  }
  if (data.length === 0) {
    return <></>;
  }

  return (
    <View className="flex flex-col">
      <FlashList
        data={data}
        renderItem={({ item }) => {
          const share = calculatePersonShare(item, pid);
          return (
            <View
              key={item.id}
              className="flex-row items-center justify-between"
            >
              <Text className="text-text-300 text-sm dark:text-text-800">
                {item.name}
              </Text>
              <Text className="text-sm font-semibold text-text-50 dark:text-text-50">
                ${share.toFixed(2)}
              </Text>
            </View>
          );
        }}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};
