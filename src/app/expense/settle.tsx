import Octicons from '@expo/vector-icons/Octicons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Modal } from 'react-native';

import { queryClient } from '@/api';
import { db } from '@/api/common/firebase';
import { useExpense } from '@/api/expenses/use-expenses';
import { usePerson } from '@/api/people/use-people';
import { useUser } from '@/api/people/use-users';
import { PersonAvatar } from '@/components/person-avatar';
import {
  ActivityIndicator,
  Button,
  Input,
  Pressable,
  showSuccessMessage,
  Text,
  View,
} from '@/components/ui';
import { useAuth } from '@/lib';
import { getBankLabel, openBankFlow } from '@/lib/payment-utils';
import { useThemeConfig } from '@/lib/use-theme-config';
import { type ExpenseIdT, type UserIdT } from '@/types';

export default function SettleScreen() {
  const router = useRouter();
  const theme = useThemeConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = id as ExpenseIdT;
  const currentUserId = useAuth.use.userId();

  const { data, isPending, isError } = useExpense({
    variables: expenseId,
  });

  const payerUserId = data?.payerUserId ?? data?.createdBy ?? null;
  const isCurrentUserPayer = !!currentUserId && currentUserId === payerUserId;
  const { data: payerUser } = useUser({
    variables: {
      userId: payerUserId as UserIdT,
      viewerUserId: currentUserId ?? null,
    },
    enabled: Boolean(payerUserId),
  });

  const [payments, setPayments] = useState<Record<string, number>>({});
  const [initialized, setInitialized] = useState(false);
  const [showPayerPicker, setShowPayerPicker] = useState(false);

  // Track previous payerUserId to reset initialization when payer changes
  const prevPayerIdRef = useRef(payerUserId);
  useEffect(() => {
    if (prevPayerIdRef.current !== payerUserId) {
      prevPayerIdRef.current = payerUserId;
      setInitialized(false);
    }
  }, [payerUserId]);

  // Initialize payments for non-payer people only
  useEffect(() => {
    if (data && !initialized) {
      const initial: Record<string, number> = {};
      data.people
        .filter((p) => p.id !== payerUserId)
        .forEach((p) => {
          initial[p.id] = p.paid;
        });
      setPayments(initial);
      setInitialized(true);
    }
  }, [data, initialized, payerUserId]);

  const handleSavePayments = useCallback(async () => {
    if (!data) return;
    try {
      const batch = writeBatch(db);
      const expenseRef = doc(db, 'expenses', expenseId);

      // Save payments for non-payer people
      for (const [personId, paidAmount] of Object.entries(payments)) {
        const personRef = doc(expenseRef, 'people', personId);
        batch.update(personRef, { paid: paidAmount });
      }

      // Auto-settle the payer's own share (they already fronted the money)
      const payerPerson = data.people.find((p) => p.id === payerUserId);
      if (payerUserId && payerPerson) {
        const payerRef = doc(expenseRef, 'people', payerUserId);
        batch.update(payerRef, { paid: payerPerson.subtotal });
      }

      // remainingAmount = what still hasn't been collected from non-payer people
      const otherPeopleTotal = data.people
        .filter((p) => p.id !== payerUserId)
        .reduce((sum, p) => sum + p.subtotal, 0);
      const remainingAmount = Math.max(
        otherPeopleTotal - Object.values(payments).reduce((s, v) => s + v, 0),
        0
      );
      batch.update(expenseRef, { remainingAmount });

      await batch.commit();

      queryClient.invalidateQueries({
        queryKey: useExpense.getKey(expenseId),
      });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['people'] });

      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save payments. Please try again.');
      console.error('Error saving payments:', error);
    }
  }, [expenseId, payments, data, payerUserId, router]);

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

  // People who owe the payer (everyone except the main payer)
  const otherPeople = data.people.filter((p) => p.id !== payerUserId);
  const totalOwed = otherPeople.reduce((sum, p) => sum + p.subtotal, 0);
  const totalCollected = Object.values(payments).reduce(
    (sum, val) => sum + val,
    0
  );
  const settledPercent =
    totalOwed > 0 ? Math.round((totalCollected / totalOwed) * 100) : 100;

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

        {/* Main payer — tappable to change */}
        <Pressable
          className="mt-4 rounded-xl border border-accent-100 bg-background-900 px-4 py-3"
          onPress={() => setShowPayerPicker(true)}
        >
          <View className="flex-row items-center justify-between">
            <Text className="!dark:text-text-200 text-base uppercase tracking-wide">
              Main payer
            </Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-xs dark:text-text-800">Change</Text>
              <Octicons
                name="pencil"
                size={13}
                color={theme.dark ? '#6b7280' : '#6b7280'}
              />
            </View>
          </View>
          <Text className="mt-1 font-futuraDemi text-base text-text-50 dark:text-text-50">
            {payerUser?.displayName ?? 'Unknown'}
          </Text>
          {payerUser?.eTransferEmail && (
            <Text className="text-text-200 mt-1 text-sm">
              {payerUser.eTransferEmail}
            </Text>
          )}
        </Pressable>

        {/* Overall collected summary */}
        <View className="mt-4 rounded-xl bg-background-900 px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm dark:text-text-800">
              Collected from others
            </Text>
            <Text
              className={`font-futuraDemi text-base ${totalCollected >= totalOwed ? 'text-success-500 dark:text-success-500' : 'text-text-50 dark:text-text-50'}`}
            >
              ${totalCollected.toFixed(2)} / ${totalOwed.toFixed(2)}
            </Text>
          </View>
          <View className="mt-1 flex-row items-center justify-end">
            <Text className="text-xs dark:text-text-800">
              {settledPercent}% settled
            </Text>
          </View>
        </View>

        {/* People who owe the payer */}
        <FlatList
          className="mt-4"
          data={otherPeople}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="mt-4 items-center">
              <Text className="dark:text-text-800">
                No other participants in this expense.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <SettlePersonCard
              personId={item.id as UserIdT}
              expenseId={expenseId}
              currentPaid={payments[item.id] ?? item.paid}
              isCurrentUserPayer={isCurrentUserPayer}
              payerInfo={{
                payerUserId,
                displayName: payerUser?.displayName,
                eTransferEmail: payerUser?.eTransferEmail,
              }}
              onUpdatePaid={(newPaid) =>
                setPayments((prev) => ({ ...prev, [item.id]: newPaid }))
              }
            />
          )}
        />
      </View>

      {/* Save Payments footer — only shown to the main payer */}
      {isCurrentUserPayer && (
        <View className="px-4 pb-8 pt-2">
          <Button
            variant="default"
            size="lg"
            label="Save Payments"
            className="w-full rounded-xl"
            onPress={handleSavePayments}
          />
        </View>
      )}

      {/* Change payer modal */}
      <PayerPickerModal
        visible={showPayerPicker}
        people={data.people}
        currentPayerId={payerUserId}
        expenseId={expenseId}
        onClose={() => setShowPayerPicker(false)}
        onPayerChanged={() => {
          setInitialized(false);
          setShowPayerPicker(false);
        }}
      />
    </>
  );
}

// ── Change-payer modal ────────────────────────────────────────────────────────

function PayerPickerModal({
  visible,
  people,
  currentPayerId,
  expenseId,
  onClose,
  onPayerChanged,
}: {
  visible: boolean;
  people: { id: string }[];
  currentPayerId: string | null;
  expenseId: ExpenseIdT;
  onClose: () => void;
  onPayerChanged: () => void;
}) {
  const handleSelect = async (personId: string) => {
    try {
      await updateDoc(doc(db, 'expenses', expenseId), {
        payerUserId: personId,
      });
      await queryClient.invalidateQueries({
        queryKey: useExpense.getKey(expenseId),
      });
      onPayerChanged();
    } catch (error) {
      Alert.alert('Error', 'Failed to update main payer. Please try again.');
      console.error('[settle] failed to change payer', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/80"
        onPress={onClose}
      >
        <Pressable
          className="mx-4 w-full rounded-xl border border-text-900 bg-background-900 p-4"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="mb-4 text-center text-lg font-bold dark:text-text-50">
            Select Main Payer
          </Text>
          <Text className="mb-3 text-center text-sm dark:text-text-800">
            The main payer fronted the expense. Others will pay them back via
            e-Transfer.
          </Text>
          {people.map((person) => (
            <PayerOption
              key={person.id}
              personId={person.id as UserIdT}
              isSelected={person.id === currentPayerId}
              onSelect={handleSelect}
            />
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PayerOption({
  personId,
  isSelected,
  onSelect,
}: {
  personId: UserIdT;
  isSelected: boolean;
  onSelect: (personId: string) => Promise<void>;
}) {
  const viewerUserId = useAuth.use.userId() ?? null;
  const { data: user } = useUser({
    variables: { userId: personId, viewerUserId },
  });

  return (
    <Pressable
      className={`mb-2 flex-row items-center gap-3 rounded-lg p-3 ${
        isSelected ? 'bg-accent-100/20' : 'bg-background-800'
      }`}
      onPress={() => onSelect(personId)}
    >
      <PersonAvatar userId={personId} size="sm" />
      <View className="flex-1">
        <Text className="font-futuraMedium dark:text-text-50">
          {user?.displayName ?? 'Unknown'}
        </Text>
        {user?.eTransferEmail ? (
          <Text className="text-sm dark:text-text-800">
            {user.eTransferEmail}
          </Text>
        ) : (
          <Text className="text-sm dark:text-text-800">
            No e-transfer email
          </Text>
        )}
      </View>
      {isSelected && <Octicons name="check" size={18} color="#00C8B3" />}
    </Pressable>
  );
}

// ── Per-person settle card ────────────────────────────────────────────────────

function SettlePersonCard({
  personId,
  expenseId,
  currentPaid,
  isCurrentUserPayer,
  payerInfo,
  onUpdatePaid,
}: {
  personId: UserIdT;
  expenseId: ExpenseIdT;
  currentPaid: number;
  isCurrentUserPayer: boolean;
  payerInfo: {
    payerUserId: string | null;
    displayName?: string;
    eTransferEmail?: string;
  };
  onUpdatePaid: (newPaid: number) => void;
}) {
  const { data, isPending, isError } = usePerson({
    variables: { expenseId, personId },
  });
  const currentUserId = useAuth.use.userId();
  const viewerUserId = currentUserId ?? null;
  const { data: user } = useUser({
    variables: { userId: personId, viewerUserId },
  });
  const { data: currentUser } = useUser({
    variables: {
      userId: currentUserId as UserIdT,
      viewerUserId,
    },
    enabled: Boolean(currentUserId),
  });
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
  const remainingAmount = Math.max(subtotal - currentPaid, 0);
  const parsedInput = parseFloat(inputValue);
  const isSaveDisabled =
    inputValue.trim() === '' ||
    isNaN(parsedInput) ||
    parsedInput < 0 ||
    parsedInput > subtotal;

  const isFullyPaid = currentPaid >= subtotal;
  const shouldShowPayToPayer =
    payerInfo.payerUserId !== null &&
    personId !== payerInfo.payerUserId &&
    remainingAmount > 0;

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

  const copyValue = async (value: string, label: string) => {
    if (!value.trim()) return;
    await Clipboard.setStringAsync(value);
    showSuccessMessage('Copied', `${label} copied to clipboard.`);
  };

  const handleOpenBank = async () => {
    try {
      await openBankFlow(currentUser?.bankPreference);
    } catch (error) {
      console.error('[settle] failed to open bank flow', error);
      Alert.alert(
        'Unable to open bank',
        'Please open your banking app manually.'
      );
    }
  };

  return (
    <View className="rounded-xl bg-background-900 p-4">
      {/* Person header row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <PersonAvatar size="lg" userId={personId} />
          <Text
            numberOfLines={1}
            className="font-futuraMedium text-lg dark:text-text-50"
          >
            {user?.displayName ?? data.guestName ?? 'Unknown'}
          </Text>
        </View>
        <Text
          className={`font-futuraDemi text-lg ${currentPaid >= subtotal ? 'text-success-500 dark:text-success-500' : 'text-text-50 dark:text-text-50'}`}
        >
          ${currentPaid.toFixed(2)}/{data.subtotal.toFixed(2)}
        </Text>
      </View>

      {/* Action buttons — only the main payer can record payments */}
      {isCurrentUserPayer && (
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
      )}

      {/* Pay to payer section */}
      {shouldShowPayToPayer && (
        <View className="mt-3 rounded-lg border border-charcoal-600 p-3">
          <Text className="text-xs uppercase tracking-wide text-text-800">
            Pay to
          </Text>

          <View className="mt-2 flex-row items-center justify-between">
            <Text className="font-futuraMedium dark:text-text-50">
              {payerInfo.displayName ?? 'Main payer'}
            </Text>
            <Pressable
              className="rounded-md border border-charcoal-600 px-2 py-1"
              onPress={() =>
                copyValue(payerInfo.displayName ?? '', 'Display name')
              }
            >
              <View className="flex-row items-center gap-2">
                <Octicons name="copy" size={14} color="#A5A9B5" />
                <Text className="text-xs dark:text-text-800">Copy</Text>
              </View>
            </Pressable>
          </View>

          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-sm dark:text-text-50">
              {payerInfo.eTransferEmail ?? 'No e-transfer email saved'}
            </Text>
            <Pressable
              className="rounded-md border border-charcoal-600 px-2 py-1"
              onPress={() => copyValue(payerInfo.eTransferEmail ?? '', 'Email')}
              disabled={!payerInfo.eTransferEmail}
            >
              <View className="flex-row items-center gap-2">
                <Octicons name="copy" size={14} color="#A5A9B5" />
                <Text className="text-xs dark:text-text-800">Copy</Text>
              </View>
            </Pressable>
          </View>

          <Pressable
            className="mt-3 items-center justify-center rounded-lg border border-accent-100 bg-accent-100/10 py-2"
            onPress={handleOpenBank}
          >
            <Text className="font-futuraDemi text-sm text-accent-100">
              Open {getBankLabel(currentUser?.bankPreference)}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
