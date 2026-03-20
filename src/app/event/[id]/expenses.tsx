import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { useEvent } from '@/api/events/use-events';
import { useExpenseIdsByEvent } from '@/api/expenses/use-expenses';
import { DottedAddButton } from '@/components/dotted-add-button';
import { ExpenseCard } from '@/components/expense-card';
import { ActivityIndicator, Text, View } from '@/components/ui';
import { useThemeConfig } from '@/lib/use-theme-config';
import { type EventIdT } from '@/types';

export default function EventExpenses() {
  const theme = useThemeConfig();
  const params = useLocalSearchParams<{ id: EventIdT }>();
  const eventId = params.id;

  const {
    data: event,
    isPending: eventPending,
    isError: eventError,
  } = useEvent({
    variables: eventId as EventIdT,
    enabled: !!eventId,
  });

  const {
    data: expenseIds,
    isPending: expensesPending,
    isError: expensesError,
  } = useExpenseIdsByEvent({
    variables: eventId as EventIdT,
    enabled: !!eventId,
  });

  const handleClose = (): void => {
    if (!eventId) return;
    router.replace(`/event/${eventId}` as const);
  };

  if (!eventId) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950 p-4">
        <Text className="mb-4 text-lg text-red-500">Missing event id</Text>
      </View>
    );
  }

  if (eventPending || expensesPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (eventError || !event) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950 p-4">
        <Text className="mb-4 text-lg text-red-500">Error loading event</Text>
      </View>
    );
  }

  if (expensesError) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950 p-4">
        <Text className="mb-4 text-lg text-red-500">
          Error loading expenses
        </Text>
      </View>
    );
  }

  // useExpenseIdsByEvent returns filtered expense ids for the event, so we can directly use it without additional filtering
  const filteredExpenses = expenseIds ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: `${event.name} - Expenses`,
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.dark ? '#1A1A1A' : '#fff',
          },
          headerTintColor: theme.dark ? '#fff' : '#000',
          headerLeft: () => (
            <Pressable onPress={handleClose} className="px-2">
              <Ionicons
                name="arrow-back"
                size={24}
                color={theme.dark ? '#fff' : '#000'}
              />
            </Pressable>
          ),
        }}
      />
      <View className="flex-1 bg-background-950 px-3">
        <FlashList
          data={filteredExpenses}
          renderItem={({ item: expenseId }) => (
            <ExpenseCard id={expenseId} config="progress" />
          )}
          keyExtractor={(expenseId) => expenseId}
          ListEmptyComponent={
            <View>
              <Text className="mb-6 mt-4 text-center text-lg text-text-800">
                No expenses for this event yet
              </Text>
              <DottedAddButton
                text="Add new expense"
                path={`/expense/add-expense?eventId=${eventId}` as any}
              />
            </View>
          }
          ListFooterComponent={
            filteredExpenses.length > 0 ? (
              <View className="pt-5">
                <DottedAddButton
                  text="Add new expense"
                  path={`/expense/add-expense?eventId=${eventId}` as any}
                />
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View className="h-5" />}
        />
      </View>
    </>
  );
}
