import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Octicons from '@expo/vector-icons/Octicons';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { Place } from '@/api/places/places-api';
import { colors, Text } from '@/components/ui';
import { formatDistance, haversineDistance } from '@/lib/geo';
import {
  formatCompactPrice,
  formatOpenStatus,
  formatPlaceCategoryLabel,
} from '@/lib/place-display';
import {
  clearPlaceRating,
  type PlaceRating,
  setPlaceRating,
  toggleBookmark,
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
  matchScore?: number;
  isHighlighted?: boolean;
  ratingValue?: PlaceRating | undefined;
  bookmarkedValue?: boolean;
  onRate?: (rating: PlaceRating) => void;
  onBookmarkToggle?: () => void;
};

export function PlaceCard({
  place,
  userLocation,
  onPress,
  showRatingButtons = true,
  matchScore,
  isHighlighted = false,
  ratingValue,
  bookmarkedValue,
  onRate,
  onBookmarkToggle,
}: Props) {
  const placeRatings = usePlacePreferences.use.placeRatings();
  const bookmarks = usePlacePreferences.use.bookmarks();
  const currentRating =
    ratingValue !== undefined
      ? ratingValue
      : (placeRatings[place.id] as PlaceRating | undefined);
  const isBookmarked =
    bookmarkedValue !== undefined ? bookmarkedValue : !!bookmarks[place.id];

  const handleRate = (rating: PlaceRating) => {
    if (onRate) {
      onRate(rating);
      return;
    }
    if (currentRating === rating) {
      clearPlaceRating(place.id);
    } else {
      setPlaceRating(place.id, rating, place);
    }
  };

  const handleToggleBookmark = () => {
    if (onBookmarkToggle) {
      onBookmarkToggle();
      return;
    }
    toggleBookmark(place.id, place);
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

  const compactPrice = formatCompactPrice(place.priceLevel);
  const typeLabel = formatPlaceCategoryLabel(place.primaryType);
  const openStatus = formatOpenStatus(place.regularOpeningHours);
  const matchPct = matchScore != null ? Math.round(matchScore * 100) : null;

  const mainContent = (
    <View>
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-baseline gap-2">
          <Text
            className="font-interSemiBold shrink text-xl text-white"
            numberOfLines={1}
          >
            {place.displayName}
          </Text>
          {compactPrice && (
            <Text className="text-sm" style={{ color: colors.text[800] }}>
              {compactPrice}
            </Text>
          )}
        </View>
        {place.rating != null && (
          <View className="ml-3 flex-row items-center gap-1">
            <Octicons name="star-fill" size={16} color={colors.accent[100]} />
            <Text className="text-base font-semibold text-white">
              {place.rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {(typeLabel || distance != null) && (
        <Text className="mt-1 text-sm" style={{ color: colors.text[800] }}>
          {[typeLabel, distance != null ? formatDistance(distance) : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}

      {place.formattedAddress && (
        <Text
          className="mt-1 text-xs"
          style={{ color: colors.text[800] }}
          numberOfLines={1}
        >
          {place.formattedAddress}
        </Text>
      )}

      {openStatus && (
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <Octicons name="clock" size={12} color={colors.text[800]} />
          {openStatus.isOpen ? (
            <Text className="text-xs" style={{ color: colors.text[800] }}>
              {openStatus.label}
            </Text>
          ) : (
            <Text className="text-xs" style={{ color: colors.text[800] }}>
              <Text
                className="text-xs font-semibold"
                style={{ color: colors.danger[500] }}
              >
                Closed
              </Text>
              {openStatus.label.replace(/^Closed/, '')}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  const actionRow = showRatingButtons && (
    <View className="mt-4 flex-row items-center justify-between">
      {matchPct != null ? (
        <Text
          className="text-sm font-bold"
          style={{ color: colors.accent[100] }}
        >
          {matchPct}% match
        </Text>
      ) : (
        <View />
      )}
      <View className="flex-row items-center gap-4">
        <Pressable
          onPress={() => handleRate('up')}
          hitSlop={8}
          accessibilityLabel={currentRating === 'up' ? 'Remove liked' : 'Liked'}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="emoticon-happy-outline"
            size={22}
            color={
              currentRating === 'up' ? colors.success[500] : colors.text[800]
            }
          />
        </Pressable>
        <Pressable
          onPress={() => handleRate('neutral')}
          hitSlop={8}
          accessibilityLabel={
            currentRating === 'neutral' ? 'Remove neutral' : 'Neutral'
          }
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="emoticon-neutral-outline"
            size={22}
            color={
              currentRating === 'neutral'
                ? colors.warning[500]
                : colors.text[800]
            }
          />
        </Pressable>
        <Pressable
          onPress={() => handleRate('down')}
          hitSlop={8}
          accessibilityLabel={
            currentRating === 'down' ? 'Remove disliked' : 'Disliked'
          }
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="emoticon-sad-outline"
            size={22}
            color={
              currentRating === 'down' ? colors.danger[500] : colors.text[800]
            }
          />
        </Pressable>
        <View
          style={{
            width: 1,
            height: 20,
            backgroundColor: colors.neutral[700],
          }}
        />
        <Pressable
          onPress={handleToggleBookmark}
          hitSlop={8}
          accessibilityLabel={
            isBookmarked ? 'Remove bookmark' : 'Bookmark place'
          }
          accessibilityRole="button"
        >
          <Octicons
            name={isBookmarked ? 'bookmark-filled' : 'bookmark'}
            size={20}
            color={isBookmarked ? colors.accent[100] : colors.text[800]}
          />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View
      className="mb-4 rounded-xl bg-neutral-850 px-4 py-5 shadow-xl"
      style={{
        borderWidth: 2,
        borderColor: isHighlighted ? colors.accent[100] + '40' : 'transparent',
      }}
    >
      {onPress ? (
        <Pressable onPress={onPress}>{mainContent}</Pressable>
      ) : (
        mainContent
      )}
      {actionRow}
    </View>
  );
}
