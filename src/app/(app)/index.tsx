import React from 'react';
import { ScrollView } from 'react-native';

import { useUpcomingEvents } from '@/api/events/use-upcoming-events';
import { useBalances } from '@/api/expenses/use-balances';
import { usePendingExpenses } from '@/api/expenses/use-pending-expenses';
import { BalanceProgress } from '@/components/dashboard/balance-progress';
import { PendingExpensesSection } from '@/components/dashboard/pending-expenses-section';
import { PinnedGroupsSection } from '@/components/dashboard/pinned-groups-section';
import { UpcomingEventsSection } from '@/components/dashboard/upcoming-events-section';
import { ActivityIndicator, Text, View } from '@/components/ui';
import { useAuth } from '@/lib';

export default function Home() {
  const userId = useAuth.use.userId();
  const {
    youOwe,
    owedToYou,
    isPending: balancesPending,
    isError: balancesError,
  } = useBalances(userId);
  const {
    data: pendingExpenseIds,
    isPending: pendingPending,
    isError: pendingError,
  } = usePendingExpenses(userId, 3);
  const {
    data: upcomingEvents,
    isPending: eventsPending,
    isError: eventsError,
  } = useUpcomingEvents(userId, 3);

  const isLoading = balancesPending || pendingPending || eventsPending;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
    >
      <View className="gap-8 py-6">
        <View className="rounded-xl bg-background-900 p-4">
          <Text className="mb-3 font-futuraDemi text-base">
            Balance Overview
          </Text>
          {balancesError ? (
            <Text className="py-2" style={{ color: '#F87171' }}>
              Error loading balances
            </Text>
          ) : (
            <BalanceProgress youOwe={youOwe} owedToYou={owedToYou} />
          )}
        </View>

        <View>
          <PendingExpensesSection
            expenseIds={pendingExpenseIds}
            userId={userId}
            isPending={pendingPending}
            isError={pendingError}
          />
        </View>

        <View>
          <UpcomingEventsSection
            events={upcomingEvents ?? []}
            isPending={eventsPending}
            isError={eventsError}
          />
        </View>

        <View>
          <PinnedGroupsSection />
        </View>
      </View>
    </ScrollView>
  );
}
