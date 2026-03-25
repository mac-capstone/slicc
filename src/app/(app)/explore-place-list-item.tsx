import React from 'react';
import { Pressable } from 'react-native';

import type { Place } from '@/api/places/places-api';
import { PlaceCard } from '@/components/place-card';

type Props = {
  item: Place;
  userLocation: { latitude: number; longitude: number } | null;
  onPress: () => void;
};

export function PlaceListItem({
  item,
  userLocation,
  onPress,
}: Props): React.ReactElement {
  return (
    <Pressable onPress={onPress} className="mb-1">
      <PlaceCard
        place={item}
        userLocation={userLocation}
        showRatingButtons={true}
      />
    </Pressable>
  );
}
