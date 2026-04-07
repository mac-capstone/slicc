import { useQuery } from '@tanstack/react-query';

import { getPlaceDetails, hasPlacesApiKey } from './places-api';

const STALE_TIME = 30 * 60 * 1000;
const GC_TIME = 24 * 60 * 60 * 1000;

export function usePlaceDetails(placeId: string | undefined) {
  return useQuery({
    queryKey: ['places', 'details', placeId],
    queryFn: () => getPlaceDetails(placeId!),
    enabled: !!placeId && hasPlacesApiKey(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}
