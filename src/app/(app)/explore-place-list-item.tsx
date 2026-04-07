import React from 'react';

import type { Place } from '@/api/places/places-api';
import { PlaceCard } from '@/components/place-card';

type Props = {
  item: Place;
  userLocation: { latitude: number; longitude: number } | null;
  onPress: (place: Place) => void;
  isHighlighted?: boolean;
  matchScore?: number;
};

export function PlaceListItem({
  item,
  userLocation,
  onPress,
  isHighlighted,
  matchScore,
}: Props): React.ReactElement {
  return (
    <PlaceCard
      place={item}
      userLocation={userLocation}
      showRatingButtons={true}
      onPress={() => onPress(item)}
      isHighlighted={isHighlighted}
      matchScore={matchScore}
    />
  );
}
