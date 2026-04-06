import { Ionicons } from '@expo/vector-icons';
import Octicons from '@expo/vector-icons/Octicons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { queryClient } from '@/api';
import { commitExpenseToFirestore } from '@/api/expenses/commit-expense';
import { useExpense } from '@/api/expenses/use-expenses';
import { useItems } from '@/api/items/use-items';
import { usePeopleIds } from '@/api/people/use-people';
import ExpenseCreationFooter from '@/components/expense-creation-footer';
import { ItemCard } from '@/components/item-card';
import { PersonCard } from '@/components/person-card';
import { SegmentToggle } from '@/components/segment-toggle';
import { ActivityIndicator, Pressable, Text, View } from '@/components/ui';
import { useAuth } from '@/lib';
import { fetchIsOnline } from '@/lib/network-status';
import { enqueuePendingExpense } from '@/lib/offline/pending-expense-queue';
import { clearTempExpense } from '@/lib/store';
import { useThemeConfig } from '@/lib/use-theme-config';
import { type EventIdT, type ExpenseIdT } from '@/types';

export default function ExpenseView() {
  const router = useRouter();
  const theme = useThemeConfig();
  const userId = useAuth.use.userId();
  const [loading, setLoading] = useState(false);
  const isProcessingRef = useRef(false);
  const {
    id,
    viewMode,
    eventId: eventIdParam,
  } = useLocalSearchParams<{
    id: ExpenseIdT;
    viewMode: 'view' | 'confirm';
    eventId?: string;
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

  const eventId = (eventIdParam ?? data.eventId) as EventIdT | undefined;

  const formattedDate = new Date(data.date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleConfirmExpense = async () => {
    if (loading || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setLoading(true);
    try {
      if (id === 'temp-expense') {
        const payload = {
          expense: data,
          eventId,
          people: data.people,
          items: data.items,
        };
        const signedInForSync = Boolean(userId && userId !== 'guest_user');
        const online = await fetchIsOnline();

        const finishLocal = async (message?: string) => {
          clearTempExpense();
          await queryClient.invalidateQueries({ queryKey: ['expenses'] });
          if (message) {
            Alert.alert('Saved locally', message);
          }
          if (eventId) {
            router.replace(`/event/${eventId}/expenses` as any);
          } else {
            router.replace('/(app)/expenses' as any);
          }
        };

        if (!online) {
          if (!signedInForSync) {
            Alert.alert(
              'No connection',
              'Connect to the internet to save this expense, or sign in to save offline and sync later.'
            );
            return;
          }
          enqueuePendingExpense(payload);
          await finishLocal(
            'You are offline. This expense will upload when you are back online.'
          );
          return;
        }

        try {
          const expenseDocId = await commitExpenseToFirestore(payload);
          clearTempExpense();
          await queryClient.invalidateQueries({ queryKey: ['expenses'] });
          if (eventId) {
            router.replace(`/event/${eventId}/expenses` as any);
          } else {
            router.replace(`/expense/${expenseDocId}` as any);
          }
          return;
        } catch (err) {
          console.error('Error saving expense:', err);
          if (!signedInForSync) {
            Alert.alert('Error', 'Failed to save expense. Please try again.');
            return;
          }
          enqueuePendingExpense(payload);
          await finishLocal(
            'Could not reach the server. Your expense is queued and will sync when possible.'
          );
          return;
        }
      }
      router.push('/');
    } catch (error) {
      Alert.alert('Error', 'Failed to save expense. Please try again.');
      console.error('Error saving expense:', error);
    } finally {
      isProcessingRef.current = false;
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
                          if (eventId) {
                            router.replace(`/event/${eventId}/expenses` as any);
                          } else {
                            router.replace('/expenses' as any);
                          }
                        },
                      },
                    ]
                  );
                } else {
                  if (eventId) {
                    router.replace(`/event/${eventId}/expenses` as any);
                  } else {
                    router.replace('/expenses' as any);
                  }
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
              onPress={() =>
                router.push({
                  pathname: '/expense/settle',
                  params: {
                    id,
                    ...(eventId ? { eventId } : {}),
                  },
                } as any)
              }
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
              <ExpenseSplitMode expenseId={id} payerUserId={data.payerUserId} />
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

export const ExpenseSplitMode = ({
  expenseId,
  payerUserId,
}: {
  expenseId: ExpenseIdT;
  payerUserId?: string;
}) => {
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
          <PersonCard
            personId={item}
            expenseId={expenseId}
            payerUserId={payerUserId}
          />
        )}
        keyExtractor={(item) => item}
        ItemSeparatorComponent={() => <View className="h-3" />}
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
