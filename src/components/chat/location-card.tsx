import Octicons from '@expo/vector-icons/Octicons';
import * as React from 'react';
import { Linking, TouchableOpacity, View } from 'react-native';

import { colors, Text } from '@/components/ui';
import type { LocationShare } from '@/types';

type Props = {
  location: LocationShare;
};

function StarRating({ rating }: { rating: number }) {
  return (
    <Text className="text-xs" style={{ color: colors.warning[400] }}>
      {'★'.repeat(Math.round(rating))}
      {'☆'.repeat(5 - Math.round(rating))}
    </Text>
  );
}

export function LocationCard({ location }: Props) {
  const openMaps = () => Linking.openURL(location.mapsUrl);

  return (
    <TouchableOpacity
      onPress={openMaps}
      className="overflow-hidden rounded-xl"
      activeOpacity={0.85}
    >
      <View
        className="rounded-xl bg-background-950 p-3"
        style={{ minWidth: 220 }}
      >
        <View className="mb-1 flex-row items-center gap-2">
          <View className="size-8 items-center justify-center rounded-full bg-primary-600/20">
            <Octicons name="location" size={14} color={colors.primary[500]} />
          </View>
          <View className="flex-1">
            <Text
              className="text-sm font-semibold text-text-50"
              numberOfLines={1}
            >
              {location.name}
            </Text>
            {location.category ? (
              <Text
                className="text-[10px]"
                style={{ color: colors.primary[400] }}
              >
                {location.category}
              </Text>
            ) : null}
          </View>
        </View>

        <Text className="mb-1 text-xs text-text-800" numberOfLines={2}>
          {location.address}
        </Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            {location.rating !== undefined ? (
              <StarRating rating={location.rating} />
            ) : null}
            {location.priceLevel ? (
              <Text className="text-xs text-text-800">
                {location.priceLevel}
              </Text>
            ) : null}
          </View>
          <View className="flex-row items-center gap-1">
            <Text
              className="text-[10px]"
              style={{ color: colors.primary[500] }}
            >
              Open in Maps
            </Text>
            <Octicons
              name="link-external"
              size={10}
              color={colors.primary[500]}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
