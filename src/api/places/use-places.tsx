import { useQuery } from '@tanstack/react-query';

import { hasPlacesApiKey, searchNearby, searchText } from './places-api';

const STALE_TIME = 30 * 60 * 1000; // 30 minutes
const GC_TIME = 24 * 60 * 60 * 1000; // 24 hours

export type UserLocation = {
  latitude: number;
  longitude: number;
};

type PlaceCategory = 'restaurant' | 'cafe' | 'bar' | 'movie_theater';

type UsePlacesParams = {
  searchQuery: string;
  userLocation: UserLocation | null;
  enabled?: boolean;
  includedTypes?: PlaceCategory[];
};

export type { PlaceCategory };

export function usePlaces({
  searchQuery,
  userLocation,
  enabled = true,
  includedTypes,
}: UsePlacesParams) {
  const trimmedQuery = searchQuery.trim();
  const hasLocation = !!userLocation;

  return useQuery({
    queryKey: [
      'places',
      trimmedQuery,
      userLocation?.latitude,
      userLocation?.longitude,
      includedTypes?.slice().sort().join(',') ?? '',
    ],
    queryFn: async () => {
      if (!hasLocation && !trimmedQuery) return [];

      if (trimmedQuery) {
        return searchText(
          trimmedQuery,
          userLocation?.latitude,
          userLocation?.longitude
        );
      }

      if (hasLocation) {
        return searchNearby({
          lat: userLocation.latitude,
          lng: userLocation.longitude,
          radiusMeters: 5000,
          includedTypes: includedTypes?.length ? includedTypes : undefined,
        });
      }

      return [];
    },
    enabled:
      enabled &&
      hasPlacesApiKey() &&
      ((hasLocation && trimmedQuery.length === 0) || trimmedQuery.length >= 2),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}
