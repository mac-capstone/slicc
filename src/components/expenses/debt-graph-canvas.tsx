import * as React from 'react';
import { useCallback, useState } from 'react';
import Svg from 'react-native-svg';

import { ActivityIndicator, Pressable, Text, View } from '@/components/ui';
import type { DebtEdge } from '@/lib/expenses/build-debt-edges';
import type { Point } from '@/lib/expenses/debt-graph-layout';
import type { NodeLabel } from '@/lib/expenses/fetch-debt-graph-labels';
import type { UserIdT } from '@/types';

import { DebtGraphSvgEdges, type EdgeLayout } from './debt-graph-svg-edges';
import { DebtGraphOverlayNodes } from './debt-graph-svg-nodes';

type Props = {
  width: number;
  height: number;
  edges: DebtEdge[];
  nodeIds: UserIdT[];
  positions: Map<UserIdT, Point>;
  labelById: Record<string, NodeLabel>;
  nodeRadius: number;
  cycleEdgeKeys: Set<string>;
  /** Shows a loading overlay while cycle simplification is in progress */
  isUpdating?: boolean;
};

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

const TAP_SIZE = 44;

export function DebtGraphCanvas({
  width,
  height,
  edges,
  nodeIds,
  positions,
  labelById,
  nodeRadius,
  cycleEdgeKeys,
  isUpdating = false,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [edgeLayouts, setEdgeLayouts] = useState<EdgeLayout[]>([]);
  const maxAmount = Math.max(...edges.map((e) => e.amount), 1);

  const edgeKeyFor = useCallback(
    (e: DebtEdge): string => `${e.from}-${e.to}`,
    []
  );

  React.useEffect(() => {
    if (selectedKey && !edges.some((e) => edgeKeyFor(e) === selectedKey)) {
      setSelectedKey(null);
    }
  }, [edges, selectedKey, edgeKeyFor]);

  const handleEdgeLayouts = useCallback((layouts: EdgeLayout[]) => {
    setEdgeLayouts(layouts);
  }, []);

  const sel = selectedKey
    ? (edges.find((e) => edgeKeyFor(e) === selectedKey) ?? null)
    : null;
  const selFrom = sel ? (labelById[sel.from]?.displayName ?? 'User') : '';
  const selTo = sel ? (labelById[sel.to]?.displayName ?? 'User') : '';

  return (
    <View style={{ width, height: height + 56 }} className="relative">
      {isUpdating ? (
        <View
          className="absolute inset-0 z-10 items-center justify-center rounded-2xl bg-background-950/75"
          pointerEvents="auto"
          accessibilityLabel="Updating expense graph"
          accessibilityRole="progressbar"
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator size="large" />
          <Text className="mt-3 text-center text-sm text-charcoal-300">
            Updating graph…
          </Text>
        </View>
      ) : null}
      <View style={{ width, height }}>
        <Svg width={width} height={height}>
          <DebtGraphSvgEdges
            edges={edges}
            positions={positions}
            nodeRadius={nodeRadius}
            maxAmount={maxAmount}
            cycleEdgeKeys={cycleEdgeKeys}
            onEdgeLayouts={handleEdgeLayouts}
          />
        </Svg>

        <View className="absolute inset-0" pointerEvents="box-none">
          {edgeLayouts.map((layout) => (
            <Pressable
              key={`tap-${layout.index}`}
              onPress={() => {
                const edge = edges[layout.index];
                if (!edge) return;
                const key = edgeKeyFor(edge);
                setSelectedKey(selectedKey === key ? null : key);
              }}
              hitSlop={8}
              style={{
                position: 'absolute',
                left: layout.midpoint.x - TAP_SIZE / 2,
                top: layout.midpoint.y - TAP_SIZE / 2,
                width: TAP_SIZE,
                height: TAP_SIZE,
                borderRadius: TAP_SIZE / 2,
              }}
            />
          ))}
        </View>

        <View className="absolute inset-0" pointerEvents="none">
          <DebtGraphOverlayNodes
            nodeIds={nodeIds}
            positions={positions}
            labelById={labelById}
            nodeRadius={nodeRadius}
          />
        </View>
      </View>

      <View className="mt-3 h-10 items-center justify-center">
        {sel ? (
          <Pressable
            onPress={() => setSelectedKey(null)}
            className="flex-row items-center rounded-full bg-charcoal-850 px-4 py-2"
          >
            <Text className="text-sm text-charcoal-200">
              {selFrom}
              <Text className="text-charcoal-500"> owes </Text>
              {selTo}:{' '}
            </Text>
            <Text className="font-futuraDemi text-sm text-primary-400">
              {formatAmount(sel.amount)}
            </Text>
          </Pressable>
        ) : (
          <Text className="text-xs text-charcoal-500">
            Tap an edge to see the amount
          </Text>
        )}
      </View>
    </View>
  );
}
