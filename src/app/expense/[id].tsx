import { Ionicons } from '@expo/vector-icons';
import Octicons from '@expo/vector-icons/Octicons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import { queryClient } from '@/api';
import { db } from '@/api/common/firebase';
import { useExpense } from '@/api/expenses/use-expenses';
import { useItems } from '@/api/items/use-items';
import { usePeopleIds } from '@/api/people/use-people';
import ExpenseCreationFooter from '@/components/expense-creation-footer';
import { ItemCard } from '@/components/item-card';
import { PersonCard } from '@/components/person-card';
import { SegmentToggle } from '@/components/segment-toggle';
import { ActivityIndicator, Pressable, Text, View } from '@/components/ui';
import { clearTempExpense, getTempExpenseState } from '@/lib/store';
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
    if (loading) return;
    setLoading(true);
    try {
      const tempExpenseState = getTempExpenseState();

      if (id === 'temp-expense' && tempExpenseState?.originalExpenseId) {
        // UPDATE existing expense — read from Zustand (always current)
        const origId = tempExpenseState.originalExpenseId;
        const batch = writeBatch(db);
        const expenseDocRef = doc(db, 'expenses', origId);

        // Delete old subcollection docs so stale items/people don't linger
        tempExpenseState.originalItemIds?.forEach((itemId) => {
          batch.delete(doc(db, 'expenses', origId, 'items', itemId));
        });
        tempExpenseState.originalPersonIds?.forEach((personId) => {
          batch.delete(doc(db, 'expenses', origId, 'people', personId));
        });

        // Write updated people (skip anyone with subtotal 0)
        const activeUpdatePeople = tempExpenseState.people.filter(
          (p) => p.subtotal > 0
        );
        activeUpdatePeople.forEach((person) => {
          const personDocRef = doc(db, 'expenses', origId, 'people', person.id);
          batch.set(personDocRef, {
            subtotal: person.subtotal,
            paid: person.paid ?? 0,
          });
        });

        // Update the expense document
        batch.update(expenseDocRef, {
          name: tempExpenseState.name,
          totalAmount: tempExpenseState.totalAmount,
          remainingAmount: tempExpenseState.remainingAmount ?? 0,
          participantCount: activeUpdatePeople.length,
          updatedAt: serverTimestamp(),
        });

        // Write updated items
        tempExpenseState.items.forEach((item) => {
          const itemDocRef = doc(db, 'expenses', origId, 'items', item.id);
          batch.set(itemDocRef, {
            name: item.name,
            amount: item.amount,
            taxRate: item.taxRate ?? 0,
            split: item.split,
            assignedPersonIds: item.assignedPersonIds,
            isTip: item.isTip ?? false,
          });
        });

        await batch.commit();
        clearTempExpense();
        await queryClient.invalidateQueries({
          queryKey: ['expenses'],
          refetchType: 'all',
        });
        router.push('/');
        return;
      }

      if (id === 'temp-expense') {
        // CREATE new expense — read from Zustand (always current)
        const batch = writeBatch(db);
        const expenseDocRef = doc(collection(db, 'expenses'));

        batch.set(expenseDocRef, {
          name: tempExpenseState!.name,
          date: tempExpenseState!.date,
          createdBy: tempExpenseState!.createdBy,
          totalAmount: tempExpenseState!.totalAmount,
          remainingAmount: tempExpenseState!.remainingAmount ?? 0,
          participantCount: tempExpenseState!.participantCount ?? 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const activeCreatePeople = (tempExpenseState!.people ?? []).filter(
          (p) => p.subtotal > 0
        );
        activeCreatePeople.forEach((person) => {
          const personDocRef = doc(expenseDocRef, 'people', person.id);
          batch.set(personDocRef, {
            subtotal: person.subtotal,
            paid: person.paid ?? 0,
          });
        });

        tempExpenseState!.items.forEach((item) => {
          const itemDocRef = doc(expenseDocRef, 'items', item.id);
          batch.set(itemDocRef, {
            name: item.name,
            amount: item.amount,
            taxRate: item.taxRate ?? 0,
            split: item.split,
            assignedPersonIds: item.assignedPersonIds,
            isTip: item.isTip ?? false,
          });
        });

        await batch.commit();
        clearTempExpense();
        await queryClient.invalidateQueries({
          queryKey: ['expenses'],
          refetchType: 'all',
        });
        router.push('/');
        return;
      }
      router.push('/');
    } catch (error) {
      Alert.alert('Error', 'Failed to save expense. Please try again.');
      console.error('Error saving expense:', error);
    } finally {
      setLoading(false);
    }
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
            <View className="flex-row items-center gap-3">
              {id !== 'temp-expense' && (
                <Pressable
                  onPress={() => router.push(`/expense/settle?id=${id}` as any)}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={28}
                    color={theme.dark ? '#fff' : '#000'}
                  />
                </Pressable>
              )}
              <Pressable
                onPress={() =>
                  router.push(`/expense/add-expense?expenseId=${id}` as any)
                }
              >
                <Ionicons
                  name="create-outline"
                  size={30}
                  color={theme.dark ? '#fff' : '#000'}
                />
              </Pressable>
            </View>
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
