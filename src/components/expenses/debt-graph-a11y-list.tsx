import * as React from 'react';

import { Text, View } from '@/components/ui';
import type { DebtEdge } from '@/lib/expenses/build-debt-edges';
import { getNodeColor } from '@/lib/expenses/debt-graph-layout';
import type { NodeLabel } from '@/lib/expenses/fetch-debt-graph-labels';

type Props = {
  edges: DebtEdge[];
  labelById: Record<string, NodeLabel>;
};

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function DebtGraphBalanceList({ edges, labelById }: Props) {
  if (edges.length === 0) return null;

  const allIds = [...new Set(edges.flatMap((e) => [e.from, e.to]))].sort();

  return (
    <View className="mt-6 px-4">
      <Text className="mb-3 text-xs uppercase tracking-widest text-charcoal-400">
        Outstanding balances
      </Text>
      {edges.map((edge, index) => {
        const fromLabel = labelById[edge.from];
        const toLabel = labelById[edge.to];
        const fromName = fromLabel?.displayName ?? 'User';
        const toName = toLabel?.displayName ?? 'User';
        const fromIdx = allIds.indexOf(edge.from);
        return (
          <View
            key={`${edge.from}-${edge.to}-${index}`}
            className="mb-2 flex-row items-center rounded-xl bg-charcoal-850 px-4 py-3"
            accessibilityLabel={`${fromName} owes ${toName} ${formatAmount(edge.amount)}`}
          >
            <View
              className="mr-3 size-3 rounded-full"
              style={{ backgroundColor: getNodeColor(fromIdx) }}
            />
            <View className="flex-1">
              <Text className="text-sm text-charcoal-100">
                {fromName}
                <Text className="text-charcoal-500"> owes </Text>
                {toName}
              </Text>
            </View>
            <Text className="ml-2 font-futuraDemi text-sm text-primary-400">
              {formatAmount(edge.amount)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
