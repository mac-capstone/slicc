import Octicons from '@expo/vector-icons/Octicons';
import { useNavigation } from '@react-navigation/native';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useLayoutEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlaceDetails } from '@/api/places/use-place-details';
import { PlaceMatchSection } from '@/components/place-match-section';
import { Button, colors, Text, TouchableOpacity, View } from '@/components/ui';
import { formatDistance, haversineDistance } from '@/lib/geo';
import { buildGoogleMapsPlaceUrl } from '@/lib/google-maps-url';
import { useUserLocation } from '@/lib/hooks/use-user-location';
import {
  formatPlaceCategoryLabel,
  formatPriceLevelForDisplay,
} from '@/lib/place-display';

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

  const handleClose = useCallback((): void => {
    router.navigate(returnHref);
  }, [returnHref]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Place Details',
      headerLeft: () => (
        <TouchableOpacity
          onPress={handleClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          activeOpacity={0.6}
        >
          <Octicons name="x" size={26} color={colors.text[800]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleClose]);

  const handleOpenMaps = async (): Promise<void> => {
    if (!place) return;
    const url = buildGoogleMapsPlaceUrl(place);
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
  };

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

  const priceLabel = formatPriceLevelForDisplay(place.priceLevel);
  const typeLabel = formatPlaceCategoryLabel(place.primaryType);

  return (
    <ScrollView
      className="flex-1 bg-background-950"
      contentContainerStyle={{ paddingBottom: bottom + 24 }}
    >
      <View className="px-4 pt-4">
        <View className="mb-6 rounded-2xl bg-neutral-850 p-5">
          <Text className="font-interSemiBold text-2xl text-white">
            {place.displayName}
          </Text>

          {place.formattedAddress && (
            <RNView className="mt-4 flex-row items-start gap-3">
              <Octicons
                name="location"
                size={18}
                color={colors.accent[100]}
                style={{ marginTop: 2 }}
              />
              <RNView className="min-w-0 flex-1">
                <Text
                  className="text-xs uppercase tracking-wide"
                  style={{ color: colors.text[800] }}
                >
                  Address
                </Text>
                <Text className="mt-1 text-base leading-6 text-white">
                  {place.formattedAddress}
                </Text>
              </RNView>
            </RNView>
          )}

          <RNView className="mt-5 gap-4">
            {place.rating != null && (
              <RNView className="flex-row items-start gap-3">
                <Octicons
                  name="star-fill"
                  size={18}
                  color={colors.accent[100]}
                  style={{ marginTop: 2 }}
                />
                <RNView className="min-w-0 flex-1">
                  <Text
                    className="text-xs uppercase tracking-wide"
                    style={{ color: colors.text[800] }}
                  >
                    Rating
                  </Text>
                  <Text className="mt-1 text-base text-white">
                    {place.rating.toFixed(1)}
                    {place.userRatingCount != null &&
                      ` · ${place.userRatingCount} reviews`}
                  </Text>
                </RNView>
              </RNView>
            )}

            {distance != null && (
              <RNView className="flex-row items-start gap-3">
                <Octicons
                  name="north-star"
                  size={18}
                  color={colors.accent[100]}
                  style={{ marginTop: 2 }}
                />
                <RNView className="min-w-0 flex-1">
                  <Text
                    className="text-xs uppercase tracking-wide"
                    style={{ color: colors.text[800] }}
                  >
                    Distance
                  </Text>
                  <Text className="mt-1 text-base text-white">
                    {formatDistance(distance)} away
                  </Text>
                </RNView>
              </RNView>
            )}

            {priceLabel && (
              <RNView className="flex-row items-start gap-3">
                <Octicons
                  name="credit-card"
                  size={18}
                  color={colors.accent[100]}
                  style={{ marginTop: 2 }}
                />
                <RNView className="min-w-0 flex-1">
                  <Text
                    className="text-xs uppercase tracking-wide"
                    style={{ color: colors.text[800] }}
                  >
                    Price
                  </Text>
                  <Text className="mt-1 text-base text-white">
                    {priceLabel}
                  </Text>
                </RNView>
              </RNView>
            )}

            {typeLabel && (
              <RNView className="flex-row items-start gap-3">
                <Octicons
                  name="tag"
                  size={18}
                  color={colors.accent[100]}
                  style={{ marginTop: 2 }}
                />
                <RNView className="min-w-0 flex-1">
                  <Text
                    className="text-xs uppercase tracking-wide"
                    style={{ color: colors.text[800] }}
                  >
                    Category
                  </Text>
                  <Text className="mt-1 text-base text-white">{typeLabel}</Text>
                </RNView>
              </RNView>
            )}
          </RNView>
        </View>

        <PlaceMatchSection place={place} />

        <Button
          label="Open in Google Maps"
          onPress={handleOpenMaps}
          variant="custom-outline"
          className="mb-4 border border-accent-100 bg-background-950"
          textClassName="text-accent-100"
        />
      </View>
    </ScrollView>
  );
}
