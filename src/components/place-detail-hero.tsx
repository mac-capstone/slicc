import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Octicons from '@expo/vector-icons/Octicons';
import React, { useEffect, useState } from 'react';
import { Pressable, View as RNView } from 'react-native';

import type { Place } from '@/api/places/places-api';
import { colors, Text, View } from '@/components/ui';
import { formatDistance } from '@/lib/geo';
import {
  formatCompactPrice,
  formatPlaceCategoryLabel,
} from '@/lib/place-display';
import {
  clearPlaceRating,
  type PlaceRating,
  setPlaceRating,
  usePlacePreferences,
} from '@/lib/place-preferences';

type Props = {
  place: Place;
  distance: number | null;
};

export function PlaceDetailHero({
  place,
  distance,
}: Props): React.ReactElement {
  const placeRatings = usePlacePreferences.use.placeRatings();
  const storeRating = placeRatings[place.id] as PlaceRating | undefined;

  const [optimistic, setOptimistic] = useState<PlaceRating | 'cleared' | null>(
    null
  );

  const currentRating =
    optimistic === 'cleared' ? undefined : (optimistic ?? storeRating);

  useEffect(() => {
    setOptimistic(null);
  }, [place.id]);

  useEffect(() => {
    if (optimistic === null) return;
    const aligned =
      optimistic === 'cleared'
        ? storeRating === undefined
        : storeRating === optimistic;
    if (aligned) setOptimistic(null);
  }, [storeRating, optimistic]);

  const handleRate = (rating: PlaceRating): void => {
    if (storeRating === rating) {
      setOptimistic('cleared');
      clearPlaceRating(place.id);
      return;
    }
    setOptimistic(rating);
    setPlaceRating(place.id, rating, place);
  };

  const compactPrice = formatCompactPrice(place.priceLevel);
  const typeLabel = formatPlaceCategoryLabel(place.primaryType);

  return (
    <View className="mb-4">
      <RNView className="flex-row items-baseline">
        <Text className="font-interSemiBold text-2xl text-white">
          {place.displayName}
        </Text>
        {compactPrice && (
          <Text className="ml-2 text-lg" style={{ color: colors.text[800] }}>
            {compactPrice}
          </Text>
        )}
      </RNView>

      {typeLabel && (
        <Text className="mt-1 text-sm" style={{ color: colors.text[800] }}>
          {typeLabel}
        </Text>
      )}

      <RNView className="mt-2 flex-row items-center gap-3">
        {place.rating != null && (
          <RNView className="flex-row items-center gap-1">
            <Octicons name="star-fill" size={14} color={colors.accent[100]} />
            <Text className="text-sm text-white">
              {place.rating.toFixed(1)}
            </Text>
          </RNView>
        )}
        {distance != null && (
          <RNView className="flex-row items-center gap-1">
            <Octicons name="location" size={13} color={colors.text[800]} />
            <Text className="text-sm" style={{ color: colors.text[800] }}>
              {formatDistance(distance)}
            </Text>
          </RNView>
        )}
      </RNView>

      <RNView className="mt-4 flex-row gap-2">
        <RatingPill
          label="Like"
          icon="emoticon-happy-outline"
          isActive={currentRating === 'up'}
          activeColor={colors.success[500]}
          onPress={() => handleRate('up')}
        />
        <RatingPill
          label="Okay"
          icon="emoticon-neutral-outline"
          isActive={currentRating === 'neutral'}
          activeColor={colors.warning[500]}
          onPress={() => handleRate('neutral')}
        />
        <RatingPill
          label="Nah"
          icon="emoticon-sad-outline"
          isActive={currentRating === 'down'}
          activeColor={colors.danger[500]}
          onPress={() => handleRate('down')}
        />
      </RNView>
    </View>
  );
}

type RatingPillProps = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  isActive: boolean;
  activeColor: string;
  onPress: () => void;
};

function RatingPill({
  label,
  icon,
  isActive,
  activeColor,
  onPress,
}: RatingPillProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={isActive ? `Remove ${label}` : label}
      accessibilityRole="button"
      className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
      style={{
        borderWidth: 1.5,
        borderColor: isActive ? activeColor : colors.neutral[600],
        backgroundColor: isActive ? `${activeColor}15` : 'transparent',
      }}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={isActive ? activeColor : colors.text[800]}
      />
      <Text
        className="text-sm font-medium"
        style={{ color: isActive ? activeColor : colors.text[800] }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
