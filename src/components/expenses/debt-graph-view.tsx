import * as React from 'react';

import { useDebtGraph } from '@/api/expenses/use-debt-graph';
import { useAuth } from '@/lib/auth';

import { DebtGraphContent } from './debt-graph-content';
import {
  DebtGraphEmpty,
  DebtGraphError,
  DebtGraphLoading,
} from './debt-graph-placeholders';

export function DebtGraphView() {
  const userId = useAuth.use.userId() ?? null;
  const { edges, nodeIds, isPending, isError } = useDebtGraph(userId);

  if (isPending) return <DebtGraphLoading />;
  if (isError) return <DebtGraphError />;
  if (edges.length === 0) return <DebtGraphEmpty />;

  return <DebtGraphContent edges={edges} nodeIds={nodeIds} userId={userId} />;
}
