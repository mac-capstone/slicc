import React from 'react';

import type { Place } from '@/api/places/places-api';
import { PlaceCard } from '@/components/place-card';

type Props = {
  item: Place;
  userLocation: { latitude: number; longitude: number } | null;
  onPress: (place: Place) => void;
};

export function PlaceListItem({
  item,
  userLocation,
  onPress,
}: Props): React.ReactElement {
  return (
    <PlaceCard
      place={item}
      userLocation={userLocation}
      showRatingButtons={true}
      onPress={() => onPress(item)}
    />
  );
}
