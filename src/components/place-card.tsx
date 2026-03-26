import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Octicons from '@expo/vector-icons/Octicons';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { Place } from '@/api/places/places-api';
import { colors, Text } from '@/components/ui';
import { formatDistance, haversineDistance } from '@/lib/geo';
import {
  clearPlaceRating,
  type PlaceRating,
  setPlaceRating,
  usePlacePreferences,
} from '@/lib/place-preferences';

type UserLocation = {
  latitude: number;
  longitude: number;
};

type Props = {
  place: Place;
  userLocation: UserLocation | null;
  onPress?: () => void;
  showRatingButtons?: boolean;
};

export function PlaceCard({
  place,
  userLocation,
  onPress,
  showRatingButtons = true,
}: Props) {
  const placeRatings = usePlacePreferences.use.placeRatings();
  const currentRating = placeRatings[place.id] as PlaceRating | undefined;

  const handleRate = (rating: PlaceRating) => {
    if (currentRating === rating) {
      clearPlaceRating(place.id);
    } else {
      setPlaceRating(place.id, rating, place);
    }
  };
  const distance =
    userLocation && place.location
      ? haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          place.location.latitude,
          place.location.longitude
        )
      : null;

  const mainContent = (
    <View className="flex-row">
      <View
        className="mr-3 size-14 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: colors.accent[200] }}
      >
        <Octicons name="location" size={24} color={colors.accent[100]} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="font-interSemiBold text-xl text-white"
          numberOfLines={1}
        >
          {place.displayName}
        </Text>
        {place.formattedAddress && (
          <View className="mt-1 flex-row items-center gap-1">
            <Feather
              name="map-pin"
              size={12}
              color={colors.text[800]}
              style={{ marginRight: 2 }}
            />
            <Text
              className="flex-1 text-sm"
              style={{ color: colors.text[800] }}
              numberOfLines={1}
            >
              {place.formattedAddress}
            </Text>
          </View>
        )}
        <View className="mt-2 flex-row items-center gap-3">
          {place.rating != null && (
            <View className="flex-row items-center gap-1">
              <Octicons name="star-fill" size={14} color={colors.accent[100]} />
              <Text className="text-sm" style={{ color: colors.text[800] }}>
                {place.rating.toFixed(1)}
                {place.userRatingCount != null && ` (${place.userRatingCount})`}
              </Text>
            </View>
          )}
          {distance != null && (
            <Text className="text-sm" style={{ color: colors.text[800] }}>
              {formatDistance(distance)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  const ratingButtons = showRatingButtons && (
    <View className="mt-3 flex-row gap-2">
      <Pressable
        onPress={() => handleRate('up')}
        className="rounded-lg p-2"
        style={{
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor:
            currentRating === 'up' ? colors.success[500] : 'transparent',
        }}
        accessibilityLabel={currentRating === 'up' ? 'Remove liked' : 'Liked'}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="emoticon-happy-outline"
          size={26}
          color={
            currentRating === 'up' ? colors.success[500] : colors.text[800]
          }
        />
      </Pressable>
      <Pressable
        onPress={() => handleRate('neutral')}
        className="rounded-lg p-2"
        style={{
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor:
            currentRating === 'neutral' ? colors.warning[500] : 'transparent',
        }}
        accessibilityLabel={
          currentRating === 'neutral' ? 'Remove neutral' : 'Neutral'
        }
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="emoticon-neutral-outline"
          size={26}
          color={
            currentRating === 'neutral' ? colors.warning[500] : colors.text[800]
          }
        />
      </Pressable>
      <Pressable
        onPress={() => handleRate('down')}
        className="rounded-lg p-2"
        style={{
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor:
            currentRating === 'down' ? colors.danger[500] : 'transparent',
        }}
        accessibilityLabel={
          currentRating === 'down' ? 'Remove disliked' : 'Disliked'
        }
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="emoticon-sad-outline"
          size={26}
          color={
            currentRating === 'down' ? colors.danger[500] : colors.text[800]
          }
        />
      </Pressable>
    </View>
  );

  return (
    <View className="mb-4 rounded-xl bg-neutral-850 p-4 shadow-xl">
      {onPress ? (
        <Pressable onPress={onPress}>{mainContent}</Pressable>
      ) : (
        mainContent
      )}
      {ratingButtons}
    </View>
  );
}
