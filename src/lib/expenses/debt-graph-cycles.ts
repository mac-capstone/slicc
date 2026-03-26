import type { UserIdT } from '@/types';

import type { DebtEdge } from './build-debt-edges';

export type CycleEdge = { from: UserIdT; to: UserIdT };

export type DetectedCycle = {
  edges: CycleEdge[];
  nettingAmount: number;
};

/**
 * Finds a single directed cycle in the debt graph using DFS with a
 * recursion-stack (3-color marking). Returns null when no cycle exists.
 */
export function findDirectedCycle(debtEdges: DebtEdge[]): DetectedCycle | null {
  const adj = new Map<string, { to: string; amount: number }[]>();
  for (const e of debtEdges) {
    const list = adj.get(e.from) ?? [];
    list.push({ to: e.to, amount: e.amount });
    adj.set(e.from, list);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const nodes = [...new Set(debtEdges.flatMap((e) => [e.from, e.to]))];

  for (const n of nodes) color.set(n, WHITE);

  let cycleStart: string | null = null;
  let cycleEnd: string | null = null;

  function dfs(u: string): boolean {
    color.set(u, GRAY);
    for (const { to: v } of adj.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        cycleStart = v;
        cycleEnd = u;
        return true;
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        if (dfs(v)) return true;
      }
    }
    color.set(u, BLACK);
    return false;
  }

  for (const n of nodes) {
    if (color.get(n) === WHITE && dfs(n)) break;
  }

  if (cycleStart === null || cycleEnd === null) return null;

  const start: string = cycleStart;
  const path: string[] = [start];
  let cur: string = cycleEnd;
  while (cur !== start) {
    path.push(cur);
    cur = parent.get(cur) ?? start;
  }
  path.reverse();

  const cycleEdges: CycleEdge[] = [];
  for (let i = 0; i < path.length; i++) {
    const from = path[i] as UserIdT;
    const to = path[(i + 1) % path.length] as UserIdT;
    cycleEdges.push({ from, to });
  }

  const amountByKey = new Map<string, number>();
  for (const e of debtEdges) {
    amountByKey.set(`${e.from}\0${e.to}`, e.amount);
  }

  const nettingAmount = Math.min(
    ...cycleEdges.map(
      (ce) => amountByKey.get(`${ce.from}\0${ce.to}`) ?? Infinity
    )
  );

  return { edges: cycleEdges, nettingAmount };
}

/**
 * Returns a Set of "from\0to" keys for quick membership checks in the UI.
 */
export function cycleEdgeKeySet(cycle: DetectedCycle): Set<string> {
  const set = new Set<string>();
  for (const e of cycle.edges) {
    set.add(`${e.from}\0${e.to}`);
  }
  return set;
}
