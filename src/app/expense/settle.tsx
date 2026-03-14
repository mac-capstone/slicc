import Octicons from '@expo/vector-icons/Octicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList } from 'react-native';

import { queryClient } from '@/api';
import { useExpense } from '@/api/expenses/use-expenses';
import { usePerson } from '@/api/people/use-people';
import { useUser } from '@/api/people/use-users';
import { PersonAvatar } from '@/components/person-avatar';
import {
  ActivityIndicator,
  Button,
  Input,
  Pressable,
  Text,
  View,
} from '@/components/ui';
import { mockData } from '@/lib/mock-data';
import { useThemeConfig } from '@/lib/use-theme-config';
import { type ExpenseIdT, type UserIdT } from '@/types';

export default function SettleScreen() {
  const router = useRouter();
  const theme = useThemeConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = id as ExpenseIdT;

  const { data, isPending, isError } = useExpense({
    variables: expenseId,
  });

  const [payments, setPayments] = useState<Record<string, number>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize payments from current data once loaded
  useEffect(() => {
    if (data && !initialized) {
      const initial: Record<string, number> = {};
      data.people.forEach((p) => {
        initial[p.id] = p.paid;
      });
      setPayments(initial);
      setInitialized(true);
    }
  }, [data, initialized]);

  const handleSavePayments = useCallback(() => {
    // Update paid values in mock data (TODO: replace with firebase write)
    const mockExpense = mockData.expenses.find((e) => e.id === expenseId);
    if (mockExpense) {
      mockExpense.people.forEach((p) => {
        if (payments[p.id] !== undefined) {
          p.doc.paid = payments[p.id];
        }
      });
      const totalPaid = mockExpense.people.reduce(
        (sum, p) => sum + p.doc.paid,
        0
      );
      mockExpense.doc.remainingAmount = Math.max(
        mockExpense.doc.totalAmount - totalPaid,
        0
      );
    }

    // Invalidate queries so the UI refreshes
    queryClient.invalidateQueries({
      queryKey: ['expenses'],
    });
    queryClient.invalidateQueries({
      queryKey: ['people'],
    });

    router.back();
  }, [expenseId, payments, router]);

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
        <Text className="text-center">Error loading expense</Text>
      </View>
    );
  }

  // Use data from useExpense hook
  const totalAmount = data.totalAmount;
  const totalCollected = Object.values(payments).reduce(
    (sum, val) => sum + val,
    0
  );
  const settledPercent =
    totalAmount > 0 ? Math.round((totalCollected / totalAmount) * 100) : 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Octicons
                name="arrow-left"
                color={theme.dark ? 'white' : 'black'}
                size={24}
              />
            </Pressable>
          ),
        }}
      />
      <View className="flex-1 px-4">
        <Text className="font-futuraBold text-3xl dark:text-text-50">
          Settle Up
        </Text>

        {/* Overall collected summary */}
        <View className="mt-4 rounded-xl bg-background-900 px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm dark:text-text-800">
              Overall collected
            </Text>
            <Text
              className={`font-futuraDemi text-base ${totalCollected >= totalAmount ? 'text-success-500 dark:text-success-500' : 'text-text-50 dark:text-text-50'}`}
            >
              ${totalCollected.toFixed(2)} / ${totalAmount.toFixed(2)}
            </Text>
          </View>
          <View className="mt-1 flex-row items-center justify-end">
            <Text className="text-xs dark:text-text-800">
              {settledPercent}% settled
            </Text>
          </View>
        </View>

        {/* People list */}
        <FlatList
          className="mt-4"
          data={data.people}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <SettlePersonCard
              personId={item.id as UserIdT}
              expenseId={expenseId}
              currentPaid={payments[item.id] ?? item.paid}
              onUpdatePaid={(newPaid) =>
                setPayments((prev) => ({ ...prev, [item.id]: newPaid }))
              }
            />
          )}
        />
      </View>

      {/* Save Payments footer */}
      <View className="px-4 pb-8 pt-2">
        <Button
          variant="default"
          size="lg"
          label="Save Payments"
          className="w-full rounded-xl"
          onPress={handleSavePayments}
        />
      </View>
    </>
  );
}

function SettlePersonCard({
  personId,
  expenseId,
  currentPaid,
  onUpdatePaid,
}: {
  personId: UserIdT;
  expenseId: ExpenseIdT;
  currentPaid: number;
  onUpdatePaid: (newPaid: number) => void;
}) {
  const { data, isPending, isError } = usePerson({
    variables: { expenseId, personId },
  });
  const { data: user } = useUser({ variables: personId });
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  if (isPending) {
    return (
      <View className="h-20 items-center justify-center rounded-xl bg-background-900">
        <ActivityIndicator />
      </View>
    );
  }
  if (isError) {
    return (
      <View className="h-20 items-center justify-center rounded-xl bg-background-900">
        <Text>Error</Text>
      </View>
    );
  }

  const subtotal = data.subtotal;
  const parsedInput = parseFloat(inputValue);
  const isSaveDisabled =
    inputValue.trim() === '' ||
    isNaN(parsedInput) ||
    parsedInput < 0 ||
    parsedInput > subtotal;

  const isFullyPaid = currentPaid >= subtotal;

  const handleMarkPaid = () => {
    onUpdatePaid(subtotal);
    setIsEditing(false);
  };

  const handleEnterAmount = () => {
    setInputValue('');
    setIsEditing(true);
  };

  const handleSaveCustom = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdatePaid(Math.min(parsed, subtotal));
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <View className="rounded-xl bg-background-900 p-4">
      {/* Person header row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <PersonAvatar size="lg" userId={personId} />
          <View>
            <Text className="font-futuraMedium text-lg dark:text-text-50">
              {user?.displayName ?? 'Unknown'}
            </Text>
          </View>
        </View>
        <Text
          className={`font-futuraDemi text-lg ${currentPaid >= subtotal ? 'text-success-500 dark:text-success-500' : 'text-text-50 dark:text-text-50'}`}
        >
          ${currentPaid.toFixed(2)}/${data.subtotal.toFixed(2)}
        </Text>
      </View>

      {/* Action buttons / input row */}
      <View className="mt-3 flex-row gap-2">
        {isEditing ? (
          <>
            <View className="flex-1">
              <Input
                money
                compact
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="0.00"
                autoFocus
              />
            </View>
            <View className="flex-1 flex-row items-center gap-2">
              <Pressable
                className={`h-10 flex-1 items-center justify-center rounded-lg bg-accent-100 ${isSaveDisabled ? 'opacity-40' : ''}`}
                onPress={handleSaveCustom}
                disabled={isSaveDisabled}
              >
                <Text className="font-bold text-black dark:text-black">
                  Save
                </Text>
              </Pressable>
              <Pressable
                className="h-10 flex-1 items-center justify-center rounded-lg border border-neutral-200 dark:border-charcoal-600"
                onPress={handleCancel}
              >
                <Text className="font-medium text-black dark:text-text-50">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable
              className={`h-10 flex-1 flex-row items-center justify-center gap-2 rounded-lg border ${isFullyPaid ? 'border-success-500 opacity-60' : 'border-accent-100'}`}
              onPress={handleMarkPaid}
              disabled={isFullyPaid}
            >
              {isFullyPaid && (
                <Octicons name="check" size={16} color="#22C55E" />
              )}
              <Text
                className={`font-bold ${isFullyPaid ? 'text-success-500 dark:text-success-500' : 'text-text-50 dark:text-text-50'}`}
              >
                {isFullyPaid ? 'Paid' : 'Mark Paid'}
              </Text>
            </Pressable>
            <Pressable
              className="h-10 flex-1 items-center justify-center rounded-lg border border-charcoal-600"
              onPress={handleEnterAmount}
            >
              <Text className="font-medium dark:text-text-50">
                Enter Amount
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
