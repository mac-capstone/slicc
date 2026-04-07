import type { UserIdT } from '@/types';

import type { DebtEdge } from './build-debt-edges';

export type Point = { x: number; y: number };

type CircleLayoutParams = {
  nodeIds: UserIdT[];
  center: Point;
  radius: number;
};

export function computeCirclePositions({
  nodeIds,
  center,
  radius,
}: CircleLayoutParams): Map<UserIdT, Point> {
  const map = new Map<UserIdT, Point>();
  const n = nodeIds.length;
  if (n === 0) return map;

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    map.set(nodeIds[i], {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return map;
}

export function edgeEndpoints(
  from: Point,
  to: Point,
  nodeRadius: number
): { start: Point; end: Point } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    start: { x: from.x + ux * nodeRadius, y: from.y + uy * nodeRadius },
    end: { x: to.x - ux * nodeRadius, y: to.y - uy * nodeRadius },
  };
}

export function bendSignForEdge(edges: DebtEdge[], index: number): 1 | -1 {
  let sign: 1 | -1 = 1;
  for (let i = 0; i < index; i++) {
    if (
      edges[i].from === edges[index].from &&
      edges[i].to === edges[index].to
    ) {
      sign = sign === 1 ? -1 : 1;
    }
  }
  return sign;
}

type CurvedPathParams = {
  from: Point;
  to: Point;
  nodeRadius: number;
  bendSign: 1 | -1;
};

export type EdgeGeometry = {
  d: string;
  midpoint: Point;
};

export function curvedPath({
  from,
  to,
  nodeRadius,
  bendSign,
}: CurvedPathParams): EdgeGeometry {
  const { start, end } = edgeEndpoints(from, to, nodeRadius);
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * bendSign;
  const ny = (dx / len) * bendSign;
  const bend = Math.min(50, len * 0.18);
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  const d = `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
  const midpoint = {
    x: 0.25 * start.x + 0.5 * cx + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * cy + 0.25 * end.y,
  };

  return { d, midpoint };
}

const NODE_COLORS = [
  '#FF8933',
  '#00DBC5',
  '#007595',
  '#00A63E',
  '#D08700',
  '#C10007',
  '#9B59B6',
  '#3498DB',
];

export function getNodeColor(index: number): string {
  return NODE_COLORS[index % NODE_COLORS.length];
}
