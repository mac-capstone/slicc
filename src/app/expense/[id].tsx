import { Ionicons } from '@expo/vector-icons';
import Octicons from '@expo/vector-icons/Octicons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { queryClient } from '@/api';
import { useExpense } from '@/api/expenses/use-expenses';
import { useItems } from '@/api/items/use-items';
import { usePeopleIds } from '@/api/people/use-people';
import ExpenseCreationFooter from '@/components/expense-creation-footer';
import { ItemCard } from '@/components/item-card';
import { PersonCard } from '@/components/person-card';
import { SegmentToggle } from '@/components/segment-toggle';
import { ActivityIndicator, Pressable, Text, View } from '@/components/ui';
import { mockData } from '@/lib/mock-data';
import { clearTempExpense } from '@/lib/store';
import { useThemeConfig } from '@/lib/use-theme-config';
import { type ExpenseIdT } from '@/types';

export default function ExpenseView() {
  const router = useRouter();
  const theme = useThemeConfig();
  const [loading, setLoading] = useState(false);
  const { id, viewMode } = useLocalSearchParams<{
    id: ExpenseIdT;
    viewMode: 'view' | 'confirm';
  }>();
  const [mode, setMode] = useState<'split' | 'items'>('split');
  const { data, isPending, isError } = useExpense({
    variables: id,
  });
  if (isPending) {
    return (
      <View className="flex-1 justify-center p-3">
        <ActivityIndicator />
      </View>
    );
  }
  if (isError) {
    return (
      <View className="flex-1 justify-center p-3">
        <Text className="text-center">Error loading Expense</Text>
      </View>
    );
  }

  const formattedDate = new Date(data.date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleConfirmExpense = async () => {
    // TODO: will be a firebase write
    setLoading(true);
    let people: any[] = [];
    let items: any[] = [];

    if (id === 'temp-expense') {
      if (data.people && data.items) {
        people = data.people.map((person) => ({
          id: person.id,
          doc: {
            name: person.name,
            color: person.color,
            userRef: person.userRef,
            subtotal: person.subtotal,
            paid: person.paid,
          },
        }));
        items = data.items.map((item) => ({
          id: item.id,
          doc: {
            name: item.name,
            amount: item.amount,
            split: item.split,
            assignedPersonIds: item.assignedPersonIds,
          },
        }));
      }

      mockData.expenses.push({
        id: uuidv4(),
        doc: {
          name: data.name,
          date: data.date,
          createdBy: data.createdBy,
          payerUserId: data.payerUserId,
          totalAmount: data.totalAmount,
          remainingAmount: data.remainingAmount,
          participantCount: data.participantCount,
        },
        people,
        items,
      } as (typeof mockData.expenses)[number]);
      clearTempExpense();
      await queryClient.invalidateQueries({
        queryKey: ['expenses', 'expenseId', id],
      });
    }
    router.push('/');
    setLoading(false);
  };

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
              className="opacity-50"
              disabled={loading}
              onPress={() => {
                if (viewMode === 'confirm') {
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
                            queryKey: ['expenses', 'expenseId', id],
                          });
                          router.replace('/');
                        },
                      },
                    ]
                  );
                } else {
                  router.back();
                }
                return true;
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
      <View className="flex-1 px-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-futuraBold text-4xl dark:text-text-50">
            {data.name}
          </Text>
          {viewMode !== 'confirm' && (
            <Pressable
              onPress={() => router.push(`/expense/settle?id=${id}` as any)}
            >
              <Ionicons
                name="create-outline"
                size={30}
                color={theme.dark ? '#fff' : '#000'}
              />
            </Pressable>
          )}
        </View>
        <Text className="text-base font-medium dark:text-text-800">
          {formattedDate}
        </Text>
        <View className="pt-4">
          <SegmentToggle value={mode} onChange={setMode} />
        </View>
        <View className="pt-4">
          {mode === 'split' && (
            <View className="">
              <ExpenseSplitMode expenseId={id} />
            </View>
          )}
          {mode === 'items' && (
            <View className="">
              <ExpenseItemsMode expenseId={id} />
            </View>
          )}
        </View>
      </View>
      <ExpenseCreationFooter
        totalAmount={data.totalAmount}
        hasNext={viewMode === 'confirm'}
        hasPrevious={viewMode === 'confirm'}
        onNextPress={handleConfirmExpense}
        onPreviousPress={() => router.back()}
        nextDisabled={loading}
        previousDisabled={loading}
        nextButtonLabel={loading ? 'Loading' : 'Confirm'}
      />
    </>
  );
}

export const ExpenseSplitMode = ({ expenseId }: { expenseId: ExpenseIdT }) => {
  const { data, isPending, isError } = usePeopleIds({
    variables: expenseId,
  });
  if (isPending) {
    return <ActivityIndicator />;
  }
  if (isError) {
    return <Text>Error loading people</Text>;
  }
  return (
    <View className="flex min-h-[60vh] w-full flex-col gap-2 pt-4">
      <FlashList
        data={data}
        renderItem={({ item }) => (
          <PersonCard personId={item} expenseId={expenseId} />
        )}
        keyExtractor={(item) => item}
        ItemSeparatorComponent={() => <View className="h-3" />} // 12px gap
      />
    </View>
  );
};

export const ExpenseItemsMode = ({ expenseId }: { expenseId: ExpenseIdT }) => {
  const { data, isPending, isError } = useItems({
    variables: expenseId,
  });
  if (isPending) {
    return <ActivityIndicator />;
  }
  if (isError) {
    return <Text>Error loading items</Text>;
  }
  return (
    <>
      <View className="flex min-h-[60vh] w-full flex-col gap-2 pt-4">
        <FlashList
          data={data}
          renderItem={({ item }) => (
            <ItemCard expenseId={expenseId} itemId={item.id} />
          )}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View className="h-3" />} // 12px gap
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      </View>
    </>
  );
};
