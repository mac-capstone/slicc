import Octicons from '@expo/vector-icons/Octicons';
import * as React from 'react';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useCycleNetting } from '@/api/expenses/use-debt-graph';
import type { ExpenseResponse } from '@/api/expenses/use-expenses';
import { ActivityIndicator, Pressable, Text, View } from '@/components/ui';
import type { DetectedCycle } from '@/lib/expenses/debt-graph-cycles';
import type { NodeLabel } from '@/lib/expenses/fetch-debt-graph-labels';
import type { UserIdT } from '@/types';

type Props = {
  cycle: DetectedCycle;
  expenses: ExpenseResponse[];
  viewerUserId: UserIdT;
  labelById: Record<string, NodeLabel>;
};

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function CycleBanner({
  cycle,
  expenses,
  viewerUserId,
  labelById,
}: Props) {
  const { mutateAsync, isPending } = useCycleNetting();
  const [settled, setSettled] = useState(false);

  const summaryLines = cycle.edges.map((e) => {
    const from = labelById[e.from]?.displayName ?? 'User';
    const to = labelById[e.to]?.displayName ?? 'User';
    return `${from} → ${to}`;
  });

  const handleSimplify = (): void => {
    Alert.alert(
      'Simplify circular debt?',
      `This will reduce each edge in the cycle by ${formatAmount(cycle.nettingAmount)}.\n\n${summaryLines.join('\n')}\n\nUnderlying expense payment records will be updated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Simplify',
          style: 'default',
          onPress: async () => {
            try {
              await mutateAsync({
                cycleEdges: cycle.edges,
                nettingAmount: cycle.nettingAmount,
                expenses,
                viewerUserId,
              });
              setSettled(true);
            } catch {
              Alert.alert('Error', 'Failed to simplify. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (settled) {
    return (
      <View className="mx-4 mt-4 flex-row items-center rounded-xl bg-green-900/30 px-4 py-3">
        <Octicons name="check-circle" size={18} color="#22C55E" />
        <Text className="ml-3 flex-1 text-sm text-green-400">
          Circular debt simplified successfully.
        </Text>
      </View>
    );
  }

  return (
    <View className="mx-4 mt-4 rounded-xl bg-amber-900/30 px-4 py-3">
      <View className="flex-row items-center">
        <Octicons name="sync" size={16} color="#F59E0B" />
        <Text className="ml-2 flex-1 font-futuraDemi text-sm text-amber-400">
          Circular debt detected
        </Text>
      </View>
      <Text className="mt-1 text-xs text-amber-200/70">
        {summaryLines.join(' → ')} forms a cycle.{' '}
        {formatAmount(cycle.nettingAmount)} can be cancelled out.
      </Text>
      <Pressable
        className="mt-3 items-center rounded-lg bg-amber-600 py-2"
        onPress={handleSimplify}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Text className="font-futuraDemi text-sm text-black">
            Simplify expense flow
          </Text>
        )}
      </Pressable>
    </View>
  );
}
