import React from 'react';
import { ScrollView, View as RNView } from 'react-native';

import { colors, Text } from '@/components/ui';
import { getDisplayTags } from '@/lib/place-display';

type Props = {
  types: string[] | undefined;
};

export function PlaceDetailTagChips({
  types,
}: Props): React.ReactElement | null {
  const tags = getDisplayTags(types);
  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-4"
      contentContainerStyle={{ gap: 8 }}
    >
      {tags.map((tag) => (
        <RNView
          key={tag}
          className="rounded-full px-4 py-2"
          style={{ borderWidth: 1, borderColor: colors.neutral[600] }}
        >
          <Text className="text-sm text-white">{tag}</Text>
        </RNView>
      ))}
    </ScrollView>
  );
}
