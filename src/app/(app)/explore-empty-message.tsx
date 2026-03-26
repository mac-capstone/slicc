import React from 'react';
import { Text } from 'react-native';

import { colors } from '@/components/ui';

import type { SectionFilter } from './explore-types';

type Props = {
  hasApiKey: boolean;
  isApiKeyError: boolean;
  sectionFilter: SectionFilter;
  hasLocation: boolean;
  hasLikes: boolean;
  isSearching: boolean;
  locationStatus: string | null;
};

export function ExploreEmptyMessage({
  hasApiKey,
  isApiKeyError,
  sectionFilter,
  hasLocation,
  hasLikes,
  isSearching,
  locationStatus,
}: Props): React.ReactElement {
  if (!hasApiKey) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to your .env to discover places.
      </Text>
    );
  }
  if (isApiKeyError) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Your Google Places API key appears to be invalid. An API key is required
        to use the Places API.
      </Text>
    );
  }
  if (sectionFilter === 'nearby' && !hasLocation) {
    const message =
      locationStatus === 'granted'
        ? 'Location unavailable. On the emulator, set a mock location (⋮ → Location → Set location).'
        : 'Enable location to find places near you.';
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        {message}
      </Text>
    );
  }
  if (
    locationStatus === 'denied' &&
    (sectionFilter === 'all' || sectionFilter === 'nearby')
  ) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Enable location to find places near you.
      </Text>
    );
  }
  if (sectionFilter === 'favorites' && !hasLikes) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Like some places to see your favorites here.
      </Text>
    );
  }
  if (sectionFilter === 'favorites' && hasLikes) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        No favorites match this category. Try a different filter.
      </Text>
    );
  }
  if (sectionFilter === 'recommended' && !hasLikes) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Like some places to get personalized recommendations.
      </Text>
    );
  }
  if (sectionFilter === 'recommended' && hasLikes) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        No new recommendations right now. Like more places to improve results.
      </Text>
    );
  }
  if (sectionFilter === 'nearby' && hasLocation) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        No places found nearby. Try a different category.
      </Text>
    );
  }
  if (sectionFilter === 'all' && !isSearching) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Search to discover places, or select Favorites, Recommended, or Nearby.
      </Text>
    );
  }
  if (isSearching && sectionFilter === 'favorites') {
    if (!hasLikes) {
      return (
        <Text
          className="px-4 text-center text-base"
          style={{ color: colors.text[800] }}
        >
          Like some places to see your favorites here.
        </Text>
      );
    }
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        No favorites match your search.
      </Text>
    );
  }
  if (isSearching && sectionFilter === 'recommended') {
    if (!hasLikes) {
      return (
        <Text
          className="px-4 text-center text-base"
          style={{ color: colors.text[800] }}
        >
          Like some places to get personalized recommendations.
        </Text>
      );
    }
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        No recommendations match your search.
      </Text>
    );
  }
  if (isSearching && sectionFilter === 'nearby' && !hasLocation) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Enable location to search nearby places.
      </Text>
    );
  }
  if (isSearching && (sectionFilter === 'all' || sectionFilter === 'nearby')) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        No places found. Try a different search.
      </Text>
    );
  }
  return (
    <Text
      className="px-4 text-center text-base"
      style={{ color: colors.text[800] }}
    >
      Like some places to get personalized recommendations, or search above.
    </Text>
  );
}
