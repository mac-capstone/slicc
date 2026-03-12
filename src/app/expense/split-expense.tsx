import Octicons from '@expo/vector-icons/Octicons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { queryClient } from '@/api/common/api-provider';
import { useExpense } from '@/api/expenses/use-expenses';
import { AddRemovePerson } from '@/components/add-remove-person';
import ExpenseCreationFooter from '@/components/expense-creation-footer';
import { ItemCard } from '@/components/item-card';
import { ItemCardDetailed } from '@/components/item-card-detailed';
import { ActivityIndicator, Pressable, Text, View } from '@/components/ui';
import { clearTempExpense, useExpenseCreation } from '@/lib/store';
import { useThemeConfig } from '@/lib/use-theme-config';
import { type ExpenseIdT, type ItemIdT } from '@/types';

const TEMP_EXPENSE_ID = 'temp-expense' as ExpenseIdT;

export default function SplitExpense() {
  const theme = useThemeConfig();
  const {
    data: tempExpense,
    isPending,
    isError,
  } = useExpense({
    variables: TEMP_EXPENSE_ID,
  });
  const hydrate = useExpenseCreation.use.hydrate();
  const [selectedItemId, setSelectedItemId] = useState<ItemIdT | undefined>(
    tempExpense?.items?.[0]?.id
  );

  useEffect(() => {
    if (!tempExpense) {
      hydrate();
    } else {
      setSelectedItemId(tempExpense.items?.[0]?.id);
    }
  }, [tempExpense, hydrate]);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerTitleStyle: {
            fontSize: 24,
            fontWeight: 'bold',
          },
          headerLeft: () => (
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Unsaved Changes',
                  'You have unsaved changes. Are you sure you want to leave?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Leave',
                      onPress: () => {
                        clearTempExpense();
                        queryClient.invalidateQueries({
                          queryKey: ['expenses', 'expenseId', TEMP_EXPENSE_ID],
                        });
                        router.replace('/');
                      },
                    },
                  ]
                );
              }}
            >
              <Octicons
                className="mr-2"
                name="x"
                color={theme.dark ? 'white' : 'black'}
                size={24}
              />
            </Pressable>
          ),
        }}
      />
      {isPending || !tempExpense || !selectedItemId ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center">
          <Text>Error loading temp expense</Text>
        </View>
      ) : selectedItemId ? (
        <>
          <View className="flex-1 px-4">
            <Text className="font-futuraBold text-4xl dark:text-text-50">
              {tempExpense.name}
            </Text>

            {selectedItemId && (
              <View className="pt-4">
                <ItemCardDetailed
                  expenseId={tempExpense.id as ExpenseIdT}
                  itemId={selectedItemId}
                />
              </View>
            )}

            <View className="flex-1 pt-4">
              <FlashList
                data={tempExpense.items}
                renderItem={({ item }) => (
                  <ItemCard
                    itemId={item.id}
                    expenseId={tempExpense.id as ExpenseIdT}
                    onPress={setSelectedItemId}
                    selected={selectedItemId === item.id}
                    mode="compact"
                  />
                )}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => <View className="h-3" />}
              />
            </View>
          </View>
          <AddRemovePerson
            itemID={selectedItemId}
            expenseId={tempExpense.id as ExpenseIdT}
          />
          <ExpenseCreationFooter
            totalAmount={tempExpense.totalAmount}
            onPreviousPress={() => router.back()}
            onNextPress={() =>
              router.push({
                pathname: '/expense/[id]',
                params: {
                  id: tempExpense.id as ExpenseIdT,
                  viewMode: 'confirm',
                },
              })
            }
          />
        </>
      ) : null}
    </>
  );
}
