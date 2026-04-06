import * as React from 'react';
import { View } from 'react-native';

import { colors } from '@/components/ui';

type Props = {
  count: number;
  total: number;
  isMine: boolean;
};

function withAlpha(hex: string, opacity: number): string {
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return `${hex}${a.toString(16).padStart(2, '0')}`;
}

/** Pure display cell — all gestures are handled by SchedulerGrid. */
export function SchedulerCell({ count, total, isMine }: Props) {
  const ratio = total > 0 ? count / total : 0;

  const bgColor =
    count === 0
      ? withAlpha(colors.scheduler.noneBase, 0.3)
      : ratio <= 0.2
        ? withAlpha(colors.scheduler.primary, 0.25)
        : ratio <= 0.4
          ? withAlpha(colors.scheduler.primary, 0.4)
          : ratio <= 0.6
            ? withAlpha(colors.scheduler.primary, 0.65)
            : ratio <= 0.8
              ? withAlpha(colors.scheduler.primary, 0.85)
              : colors.scheduler.primary;

  return (
    <View
      style={{
        flex: 1,
        height: 22,
        margin: 1,
        borderRadius: 3,
        backgroundColor: bgColor,
        borderWidth: isMine ? 1.5 : 0,
        borderColor: isMine ? colors.scheduler.mine : 'transparent',
      }}
      accessibilityLabel={`${count} of ${total} available`}
      accessibilityState={{ selected: isMine }}
    />
  );
}
