import * as React from 'react';
import { useEffect } from 'react';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { G, Path } from 'react-native-svg';

import type { DebtEdge } from '@/lib/expenses/build-debt-edges';
import {
  bendSignForEdge,
  curvedPath,
  type EdgeGeometry,
  getNodeColor,
  type Point,
} from '@/lib/expenses/debt-graph-layout';
import type { UserIdT } from '@/types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DASH_LEN = 10;
const GAP_LEN = 14;
const CYCLE = DASH_LEN + GAP_LEN;
const MIN_STROKE = 2;
const MAX_STROKE = 8;

function strokeForAmount(amount: number, maxAmount: number): number {
  if (maxAmount <= 0) return MIN_STROKE;
  const t = amount / maxAmount;
  return MIN_STROKE + t * (MAX_STROKE - MIN_STROKE);
}

function FlowingEdge({
  d,
  color,
  strokeWidth,
}: {
  d: string;
  color: string;
  strokeWidth: number;
}) {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withRepeat(withTiming(-CYCLE, { duration: 800 }), -1, false);
  }, [offset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={`${DASH_LEN} ${GAP_LEN}`}
      strokeLinecap="round"
      fill="none"
      opacity={0.65}
      animatedProps={animatedProps}
    />
  );
}

export type EdgeLayout = EdgeGeometry & { index: number };

type Props = {
  edges: DebtEdge[];
  positions: Map<UserIdT, Point>;
  nodeRadius: number;
  maxAmount: number;
  onEdgeLayouts: (layouts: EdgeLayout[]) => void;
};

export function DebtGraphSvgEdges({
  edges,
  positions,
  nodeRadius,
  maxAmount,
  onEdgeLayouts,
}: Props) {
  const allIds = React.useMemo(
    () => [...new Set(edges.flatMap((e) => [e.from, e.to]))].sort(),
    [edges]
  );

  const computed = React.useMemo(() => {
    const layouts: EdgeLayout[] = [];
    const geoPairs: { geo: EdgeGeometry; color: string; sw: number }[] = [];

    edges.forEach((edge, index) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return;

      const bend = bendSignForEdge(edges, index);
      const geo = curvedPath({ from, to, nodeRadius, bendSign: bend });
      layouts.push({ ...geo, index });

      const fromIdx = allIds.indexOf(edge.from);
      const color = getNodeColor(fromIdx);
      const sw = strokeForAmount(edge.amount, maxAmount);
      geoPairs.push({ geo, color, sw });
    });

    return { layouts, geoPairs };
  }, [edges, positions, nodeRadius, maxAmount, allIds]);

  React.useEffect(() => {
    onEdgeLayouts(computed.layouts);
  }, [computed.layouts, onEdgeLayouts]);

  return (
    <G>
      {computed.geoPairs.map(({ geo, color, sw }, i) => (
        <G key={`edge-${i}`}>
          <Path
            d={geo.d}
            stroke={color}
            strokeWidth={sw}
            fill="none"
            opacity={0.15}
          />
          <FlowingEdge d={geo.d} color={color} strokeWidth={sw} />
        </G>
      ))}
    </G>
  );
}
