import * as React from 'react';
import { View } from 'react-native';

import { colors } from '@/components/ui';

type Props = {
  count: number;
  total: number;
  isMine: boolean;
};

/** Pure display cell — all gestures are handled by SchedulerGrid. */
export function SchedulerCell({ count, total, isMine }: Props) {
  const ratio = total > 0 ? count / total : 0;

  const bgColor =
    count === 0
      ? colors.background[900]
      : ratio <= 0.25
        ? colors.primary[900]
        : ratio <= 0.5
          ? colors.primary[700]
          : ratio <= 0.75
            ? colors.primary[500]
            : colors.primary[400];

  return (
    <View
      style={{
        flex: 1,
        height: 22,
        margin: 1,
        borderRadius: 3,
        backgroundColor: bgColor,
        borderWidth: isMine ? 1.5 : 0,
        borderColor: isMine ? colors.text[50] : 'transparent',
      }}
      accessibilityLabel={`${count} of ${total} available`}
      accessibilityState={{ selected: isMine }}
    />
  );
}
