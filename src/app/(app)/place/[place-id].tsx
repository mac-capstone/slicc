import Octicons from '@expo/vector-icons/Octicons';
import { useNavigation } from '@react-navigation/native';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useLayoutEffect } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlaceDetails } from '@/api/places/use-place-details';
import { PlaceDetailHero } from '@/components/place-detail-hero';
import { PlaceDetailInfoCard } from '@/components/place-detail-info-card';
import { PlaceDetailTagChips } from '@/components/place-detail-tag-chips';
import { PlaceMatchSection } from '@/components/place-match-section';
import { PlaceSocialMatchSection } from '@/components/place-social-match-section';
import { Button, colors, Text, TouchableOpacity, View } from '@/components/ui';
import { haversineDistance } from '@/lib/geo';
import { useUserLocation } from '@/lib/hooks/use-user-location';
import { toggleBookmark, usePlacePreferences } from '@/lib/place-preferences';

function resolveReturnHref(param: string | string[] | undefined): Href {
  const raw = Array.isArray(param) ? param[0] : param;
  if (raw === 'home' || raw === '/') return '/';
  if (raw && raw.startsWith('/')) return raw as Href;
  if (raw === 'expenses') return '/expenses';
  if (raw === 'social') return '/social';
  return '/explore';
}

export default function PlaceDetailScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { bottom } = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    'place-id': string | string[];
    returnTo?: string | string[];
  }>();
  const placeIdParam = params['place-id'];
  const placeId = Array.isArray(placeIdParam) ? placeIdParam[0] : placeIdParam;

  const returnHref = resolveReturnHref(params.returnTo);

  const { location: userLocation } = useUserLocation();
  const { data: place, isPending, isError, error } = usePlaceDetails(placeId);

  const bookmarks = usePlacePreferences.use.bookmarks();
  const isBookmarked = placeId ? !!bookmarks[placeId] : false;

  const handleClose = useCallback((): void => {
    router.navigate(returnHref);
  }, [returnHref]);

  const handleToggleBookmark = useCallback((): void => {
    if (!placeId) return;
    toggleBookmark(placeId, place ?? undefined);
  }, [placeId, place]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerLeft: () => (
        <TouchableOpacity
          onPress={handleClose}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          activeOpacity={0.6}
        >
          <Octicons name="arrow-left" size={24} color={colors.text[800]} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleToggleBookmark}
          accessibilityLabel={isBookmarked ? 'Remove from saved' : 'Save place'}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          activeOpacity={0.6}
        >
          <Octicons
            name={isBookmarked ? 'bookmark-filled' : 'bookmark'}
            size={22}
            color={isBookmarked ? colors.accent[100] : colors.text[800]}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleClose, handleToggleBookmark, isBookmarked]);

  if (!placeId) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950 px-6">
        <Text className="mb-4 text-center text-lg text-red-500">
          Missing place information.
        </Text>
        <Button label="Go back" onPress={() => router.navigate(returnHref)} />
      </View>
    );
  }

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <ActivityIndicator color={colors.accent[100]} />
      </View>
    );
  }

  if (isError || !place) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950 px-6">
        <Text className="mb-2 text-center text-lg text-white">
          Could not load this place.
        </Text>
        <Text
          className="mb-6 text-center text-sm"
          style={{ color: colors.text[800] }}
        >
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Text>
        <Button label="Go back" onPress={() => router.navigate(returnHref)} />
      </View>
    );
  }

  const distance =
    userLocation && place.location
      ? haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          place.location.latitude,
          place.location.longitude
        )
      : null;

  return (
    <ScrollView
      className="flex-1 bg-background-950"
      contentContainerStyle={{ paddingBottom: bottom + 24 }}
    >
      <View className="px-4 pt-4">
        <PlaceDetailHero place={place} distance={distance} />

        <PlaceDetailInfoCard place={place} />

        <PlaceDetailTagChips types={place.types} />

        <PlaceMatchSection place={place} />

        <PlaceSocialMatchSection place={place} />
      </View>
    </ScrollView>
  );
}
