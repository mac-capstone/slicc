import Octicons from '@expo/vector-icons/Octicons';
import React from 'react';
import { View as RNView } from 'react-native';

import { colors, Text } from '@/components/ui';
import { formatOpeningHoursSummary } from '@/lib/place-display';

type Props = {
  weekdayDescriptions: string[] | undefined;
};

export function PlaceDetailHoursRow({
  weekdayDescriptions,
}: Props): React.ReactElement | null {
  const hoursSummary = formatOpeningHoursSummary(weekdayDescriptions);

  if (!hoursSummary) {
    return null;
  }

  return (
    <RNView className="mt-4 flex-row items-start gap-3">
      <Octicons
        name="clock"
        size={18}
        color={colors.accent[100]}
        style={{ marginTop: 2 }}
      />
      <Text className="min-w-0 flex-1 text-base leading-6 text-white">
        {hoursSummary}
      </Text>
    </RNView>
  );
}
