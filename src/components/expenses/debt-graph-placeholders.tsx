import Octicons from '@expo/vector-icons/Octicons';
import * as React from 'react';

import { ActivityIndicator, Text, View } from '@/components/ui';

export function DebtGraphLoading(): React.ReactElement {
  return (
    <View
      className="flex-1 items-center justify-center p-4"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading balances"
    >
      <ActivityIndicator size="large" />
      <Text className="mt-4 text-sm text-charcoal-400">Loading balances…</Text>
    </View>
  );
}

export function DebtGraphError(): React.ReactElement {
  return (
    <View
      className="flex-1 items-center justify-center p-6"
      accessible
      accessibilityRole="alert"
      accessibilityLabel="Error loading graph"
    >
      <Octicons name="alert" size={32} color="#F87171" />
      <Text className="mt-4 text-center text-base text-charcoal-200">
        Something went wrong
      </Text>
      <Text className="mt-1 text-center text-sm text-charcoal-500">
        Could not load expense data for the graph.
      </Text>
    </View>
  );
}

export function DebtGraphEmpty(): React.ReactElement {
  return (
    <View
      className="flex-1 items-center justify-center p-6"
      accessible
      accessibilityRole="summary"
      accessibilityLabel="No outstanding balances"
    >
      <Octicons name="check-circle" size={40} color="#22C55E" />
      <Text className="mt-4 text-center text-lg text-charcoal-200">
        All settled up!
      </Text>
      <Text className="mt-2 text-center text-sm text-charcoal-500">
        No outstanding balances between you and your friends.
      </Text>
    </View>
  );
}
