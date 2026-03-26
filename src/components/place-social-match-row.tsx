import Octicons from '@expo/vector-icons/Octicons';
import React from 'react';
import { View as RNView } from 'react-native';

import { matchLabel } from '@/components/place-match-content';
import { colors, Text } from '@/components/ui';

function pct01(n: number): string {
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

type Props = {
  icon: keyof typeof Octicons.glyphMap;
  title: string;
  subtitle: string;
  composite: number;
};

export function PlaceSocialMatchRow({
  icon,
  title,
  subtitle,
  composite,
}: Props): React.ReactElement {
  return (
    <RNView className="flex-row items-center justify-between gap-3 py-2">
      <RNView className="min-w-0 flex-1 flex-row items-center gap-3">
        <Octicons name={icon} size={18} color={colors.accent[100]} />
        <RNView className="min-w-0 flex-1">
          <Text className="text-base text-white" numberOfLines={1}>
            {title}
          </Text>
          <Text
            className="mt-0.5 text-xs"
            style={{ color: colors.text[800] }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </RNView>
      </RNView>
      <RNView className="items-end">
        <Text className="text-base text-accent-100">{pct01(composite)}</Text>
        <Text
          className="mt-0.5 text-xs"
          style={{ color: colors.text[800] }}
          numberOfLines={1}
        >
          {matchLabel(composite)}
        </Text>
      </RNView>
    </RNView>
  );
}
