import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { useMemo } from 'react';
import { Dimensions } from 'react-native';

import { ScrollView, View } from '@/components/ui';
import type { DebtEdge } from '@/lib/expenses/build-debt-edges';
import { computeCirclePositions } from '@/lib/expenses/debt-graph-layout';
import { fetchDebtGraphLabels } from '@/lib/expenses/fetch-debt-graph-labels';
import type { UserIdT } from '@/types';

import { DebtGraphBalanceList } from './debt-graph-a11y-list';
import { DebtGraphCanvas } from './debt-graph-canvas';

const NODE_RADIUS = 24;
const GRAPH_PAD = 52;

type ContentProps = {
  edges: DebtEdge[];
  nodeIds: UserIdT[];
  userId: string | null;
};

export function DebtGraphContent({ edges, nodeIds, userId }: ContentProps) {
  const { data: labelById = {} } = useQuery({
    queryKey: ['debt-graph-labels', nodeIds, userId],
    queryFn: () => fetchDebtGraphLabels(nodeIds, userId),
    enabled: nodeIds.length > 0,
  });

  const layout = useMemo(() => {
    const screenW = Dimensions.get('window').width;
    const size = Math.min(screenW - 32, 420);
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - NODE_RADIUS - GRAPH_PAD;
    const positions = computeCirclePositions({
      nodeIds,
      center: { x: cx, y: cy },
      radius: Math.max(radius, 60),
    });
    return { size, positions };
  }, [nodeIds]);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="items-center px-4 pt-4">
        <DebtGraphCanvas
          width={layout.size}
          height={layout.size}
          edges={edges}
          nodeIds={nodeIds}
          positions={layout.positions}
          labelById={labelById}
          nodeRadius={NODE_RADIUS}
        />
      </View>
      <DebtGraphBalanceList edges={edges} labelById={labelById} />
    </ScrollView>
  );
}
