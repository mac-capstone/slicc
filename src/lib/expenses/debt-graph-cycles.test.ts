import type { UserIdT } from '@/types';

import type { DebtEdge } from './build-debt-edges';
import { cycleEdgeKeySet, findDirectedCycle } from './debt-graph-cycles';

const uid = (s: string): UserIdT => s as UserIdT;

function edge(from: string, to: string, amount: number): DebtEdge {
  return { from: uid(from), to: uid(to), amount };
}

describe('findDirectedCycle', () => {
  it('returns null for an empty graph', () => {
    expect(findDirectedCycle([])).toBeNull();
  });

  it('returns null when no cycle exists (DAG)', () => {
    const edges = [edge('a', 'b', 10), edge('b', 'c', 5)];
    expect(findDirectedCycle(edges)).toBeNull();
  });

  it('detects a 2-node mutual debt cycle', () => {
    const edges = [edge('a', 'b', 10), edge('b', 'a', 7)];
    const result = findDirectedCycle(edges);
    expect(result).not.toBeNull();
    expect(result!.edges).toHaveLength(2);
    expect(result!.nettingAmount).toBe(7);
  });

  it('detects a 3-node cycle and returns min edge as netting amount', () => {
    const edges = [edge('a', 'b', 20), edge('b', 'c', 15), edge('c', 'a', 10)];
    const result = findDirectedCycle(edges);
    expect(result).not.toBeNull();
    expect(result!.edges).toHaveLength(3);
    expect(result!.nettingAmount).toBe(10);

    const keys = cycleEdgeKeySet(result!);
    expect(keys.has('a\0b')).toBe(true);
    expect(keys.has('b\0c')).toBe(true);
    expect(keys.has('c\0a')).toBe(true);
  });

  it('returns null for a graph with no back-edge', () => {
    const edges = [edge('a', 'b', 5), edge('a', 'c', 3), edge('b', 'c', 2)];
    expect(findDirectedCycle(edges)).toBeNull();
  });

  it('handles a 4-node cycle', () => {
    const edges = [
      edge('a', 'b', 100),
      edge('b', 'c', 50),
      edge('c', 'd', 25),
      edge('d', 'a', 10),
    ];
    const result = findDirectedCycle(edges);
    expect(result).not.toBeNull();
    expect(result!.nettingAmount).toBe(10);
  });
});

describe('cycleEdgeKeySet', () => {
  it('builds a set of from\\0to keys', () => {
    const cycle = {
      edges: [
        { from: uid('x'), to: uid('y') },
        { from: uid('y'), to: uid('x') },
      ],
      nettingAmount: 5,
    };
    const keys = cycleEdgeKeySet(cycle);
    expect(keys.size).toBe(2);
    expect(keys.has('x\0y')).toBe(true);
    expect(keys.has('y\0x')).toBe(true);
  });
});
