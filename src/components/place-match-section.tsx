import React from 'react';

import type { Place } from '@/api/places/places-api';
import { usePlaceMatch } from '@/api/places/use-place-match';
import { colors, Text, View } from '@/components/ui';
import { useAuth, useLikedPlaces, useRatedPlaceIds } from '@/lib';
import { useUserLocation } from '@/lib/hooks/use-user-location';

import { PlaceMatchContent } from './place-match-content';

type Props = {
  place: Place;
};

export function PlaceMatchSection({ place }: Props): React.ReactElement {
  const userId = useAuth.use.userId();
  const likedPlaces = useLikedPlaces();
  const ratedPlaceIds = useRatedPlaceIds();
  const { location: userLocation } = useUserLocation();
  const { breakdown, hasLikes, isCollabPending, isCollabEnabled, collabError } =
    usePlaceMatch({
      place,
      likedPlaces,
      userLocation,
      userId,
      ratedPlaceIds,
    });

  if (!hasLikes) {
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
    return <View />;
  }

  return (
    <PlaceMatchContent
      breakdown={breakdown}
      isCollabPending={isCollabPending}
      isCollabEnabled={isCollabEnabled}
      collabError={collabError}
    />
  );
}
