import React, { useDeferredValue, useMemo } from 'react';
import { ActivityIndicator, View as RNView } from 'react-native';

import type { Place } from '@/api/places/places-api';
import { usePlaceMatch } from '@/api/places/use-place-match';
import { colors, Text, View } from '@/components/ui';
import {
  type PlaceRating,
  useAuth,
  useLikedPlaces,
  usePlacePreferences,
  useRatedPlaceIds,
} from '@/lib';
import { useUserLocation } from '@/lib/hooks/use-user-location';

import { PlaceMatchContent } from './place-match-content';

type Props = {
  place: Place;
};

function likesKey(places: Place[]): string {
  return places
    .map((p) => p.id)
    .sort()
    .join(',');
}

function ratedKey(ids: Set<string>): string {
  return [...ids].sort().join(',');
}

export function PlaceMatchSection({ place }: Props): React.ReactElement {
  const userId = useAuth.use.userId();
  const likedPlaces = useLikedPlaces();
  const ratedPlaceIds = useRatedPlaceIds();
  const { location: userLocation } = useUserLocation();
  const placeRatings = usePlacePreferences.use.placeRatings();
  const currentRating = placeRatings[place.id] as PlaceRating | undefined;

  const deferredLikedPlaces = useDeferredValue(likedPlaces);
  const deferredRatedIds = useDeferredValue(ratedPlaceIds);
  const deferredRating = useDeferredValue(currentRating);

  const inputsStale = useMemo(() => {
    return (
      likesKey(likedPlaces) !== likesKey(deferredLikedPlaces) ||
      ratedKey(ratedPlaceIds) !== ratedKey(deferredRatedIds) ||
      currentRating !== deferredRating
    );
  }, [
    likedPlaces,
    deferredLikedPlaces,
    ratedPlaceIds,
    deferredRatedIds,
    currentRating,
    deferredRating,
  ]);

  const hasLikesNow = likedPlaces.length > 0;

  const {
    breakdown,
    isCollabPending,
    isCollabEnabled,
    collabError,
    isMatchSignalsFetching,
  } = usePlaceMatch({
    place,
    likedPlaces: deferredLikedPlaces,
    userLocation,
    userId,
    ratedPlaceIds: deferredRatedIds,
    placeRating: deferredRating,
  });

  const isRecalculating = inputsStale || isMatchSignalsFetching;

  if (!hasLikesNow) {
    return (
      <View className="mb-6 rounded-2xl bg-neutral-850 p-5">
        <Text className="font-interSemiBold text-lg text-white">
          Match for you
        </Text>
        <Text
          className="mt-2 text-sm leading-5"
          style={{ color: colors.text[800] }}
        >
          Like places you enjoy on Explore to see how well spots match your
          taste, distance, and community signals.
        </Text>
      </View>
    );
  }

  if (!breakdown) {
    return (
      <View className="mb-6 rounded-2xl bg-neutral-850 p-5">
        <RNView style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text className="text-sm" style={{ color: colors.text[800] }}>
            Match for you
          </Text>
          <ActivityIndicator
            size="small"
            color={colors.accent[100]}
            style={{ position: 'absolute', right: 0 }}
          />
        </RNView>
        <Text
          className="font-interSemiBold mt-1 text-3xl"
          style={{ color: colors.neutral[600] }}
        >
          —
        </Text>
      </View>
    );
  }

  return (
    <PlaceMatchContent
      breakdown={breakdown}
      isCollabPending={isCollabPending}
      isCollabEnabled={isCollabEnabled}
      collabError={collabError}
      isRecalculating={isRecalculating}
    />
  );
}
