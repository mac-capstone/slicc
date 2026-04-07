import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { useCycleNetting } from '@/api/expenses/use-debt-graph';
import type { ExpenseResponse } from '@/api/expenses/use-expenses';
import { ScrollView, View } from '@/components/ui';
import type { DebtEdge } from '@/lib/expenses/build-debt-edges';
import type { DetectedCycle } from '@/lib/expenses/debt-graph-cycles';
import { cycleEdgeKeySet } from '@/lib/expenses/debt-graph-cycles';
import { computeCirclePositions } from '@/lib/expenses/debt-graph-layout';
import { fetchDebtGraphLabels } from '@/lib/expenses/fetch-debt-graph-labels';
import type { UserIdT } from '@/types';

import { CycleBanner } from './cycle-banner';
import { DebtGraphBalanceList } from './debt-graph-a11y-list';
import { DebtGraphCanvas } from './debt-graph-canvas';

const NODE_RADIUS = 24;
const GRAPH_PAD = 52;

type ContentProps = {
  edges: DebtEdge[];
  nodeIds: UserIdT[];
  userId: string | null;
  cycle: DetectedCycle | null;
  expenses: ExpenseResponse[];
};

export function DebtGraphContent({
  edges,
  nodeIds,
  userId,
  cycle,
  expenses,
}: ContentProps) {
  const { mutateAsync: simplifyCycle, isPending: isSimplifyPending } =
    useCycleNetting();

  const { data: labelById = {} } = useQuery({
    queryKey: ['debt-graph-labels', nodeIds, userId],
    queryFn: () => fetchDebtGraphLabels(nodeIds, userId),
    enabled: nodeIds.length > 0,
  });

  const { width: windowWidth } = useWindowDimensions();

  const layout = useMemo(() => {
    const size = Math.min(windowWidth - 32, 420);
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - NODE_RADIUS - GRAPH_PAD;
    const positions = computeCirclePositions({
      nodeIds,
      center: { x: cx, y: cy },
      radius: Math.max(radius, 60),
    });
    return { size, positions };
  }, [nodeIds, windowWidth]);

  const cycleKeys = useMemo(
    () => (cycle ? cycleEdgeKeySet(cycle) : new Set<string>()),
    [cycle]
  );

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
          cycleEdgeKeys={cycleKeys}
          isUpdating={isSimplifyPending}
        />
      </View>
      {cycle && userId ? (
        <CycleBanner
          cycle={cycle}
          expenses={expenses}
          viewerUserId={userId as UserIdT}
          labelById={labelById}
          mutateAsync={simplifyCycle}
          isPending={isSimplifyPending}
        />
      ) : null}
      <DebtGraphBalanceList edges={edges} labelById={labelById} />
    </ScrollView>
  );
}
