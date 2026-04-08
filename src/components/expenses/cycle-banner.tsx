import Octicons from '@expo/vector-icons/Octicons';
import * as React from 'react';
import { useState } from 'react';
import { Alert } from 'react-native';

import type { ExpenseResponse } from '@/api/expenses/use-expenses';
import { ActivityIndicator, Pressable, Text, View } from '@/components/ui';
import type {
  CycleNettingParams,
  CycleNettingResult,
} from '@/lib/expenses/apply-cycle-netting';
import type { DetectedCycle } from '@/lib/expenses/debt-graph-cycles';
import type { NodeLabel } from '@/lib/expenses/fetch-debt-graph-labels';
import type { UserIdT } from '@/types';

type Props = {
  cycle: DetectedCycle;
  expenses: ExpenseResponse[];
  viewerUserId: UserIdT;
  labelById: Record<string, NodeLabel>;
  mutateAsync: (params: CycleNettingParams) => Promise<CycleNettingResult>;
  isPending: boolean;
};

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** One name per hop; e.g. A→B and B→A becomes "A → B → A", not "A → B → B → A". */
function cycleSummaryPath(
  cycle: DetectedCycle,
  labelById: Record<string, NodeLabel>
): string {
  const { edges } = cycle;
  if (edges.length === 0) return '';
  const segments: string[] = [];
  const firstName = labelById[edges[0].from]?.displayName ?? 'User';
  segments.push(firstName);
  for (const e of edges) {
    segments.push(labelById[e.to]?.displayName ?? 'User');
  }
  return segments.join(' → ');
}

export function CycleBanner({
  cycle,
  expenses,
  viewerUserId,
  labelById,
  mutateAsync,
  isPending,
}: Props) {
  const [settled, setSettled] = useState(false);

  const cyclePathText = cycleSummaryPath(cycle, labelById);

  const handleSimplify = (): void => {
    Alert.alert(
      'Simplify circular debt?',
      `This will reduce each edge in the cycle by ${formatAmount(cycle.nettingAmount)}.\n\n${cyclePathText}\n\nUnderlying expense payment records will be updated.`,
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
    <View className="mx-4 mt-4 rounded-xl bg-red-900/30 px-4 py-3">
      <View className="flex-row items-center">
        <Octicons name="sync" size={16} color="#F87171" />
        <Text className="ml-2 flex-1 font-futuraDemi text-sm text-red-400">
          Circular debt detected
        </Text>
      </View>
      <Text className="mt-1 text-xs text-red-200/70">
        {cyclePathText} forms a cycle. {formatAmount(cycle.nettingAmount)} can
        be cancelled out.
      </Text>
      <Pressable
        className="mt-3 items-center rounded-lg border-2 border-red-500 bg-transparent py-2 active:opacity-80"
        onPress={handleSimplify}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <Text className="font-futuraDemi text-sm text-red-400">
            Simplify expense flow
          </Text>
        )}
      </Pressable>
    </View>
  );
}
