import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchPlaceMatchSignals } from '@/api/places/compute-match-for-subject';
import { DEFAULT_LOCATION } from '@/lib/geo';
import { getDietaryPreferenceIds } from '@/lib/hooks/use-user-settings';
import {
  type CompositeRankingContext,
  getPlaceMatchBreakdown,
  type PlaceMatchBreakdown,
  rankPlacesByContentRelevance,
} from '@/lib/recommendation-utils';
import type { UserIdT } from '@/types';

import type { Place } from './places-api';

const STALE_TIME = 60 * 60 * 1000;
const GC_TIME = 24 * 60 * 60 * 1000;

export type UsePlaceMatchParams = {
  place: Place;
  likedPlaces: Place[];
  userLocation: { latitude: number; longitude: number } | null;
  userId: string | null;
  ratedPlaceIds: Set<string>;
  enabled?: boolean;
};

export type UsePlaceMatchResult = {
  hasLikes: boolean;
  breakdown: PlaceMatchBreakdown | null;
  isCollabPending: boolean;
  isCollabEnabled: boolean;
  collabError: boolean;
};

export function usePlaceMatch({
  place,
  likedPlaces,
  userLocation,
  userId,
  ratedPlaceIds,
  enabled = true,
}: UsePlaceMatchParams): UsePlaceMatchResult {
  const hasLikes = likedPlaces.length > 0;
  const searchLocation = userLocation ?? DEFAULT_LOCATION;
  const useCollaborative = !!userId && userId !== 'guest_user' && hasLikes;

  const contentScoreById = useMemo(() => {
    if (!hasLikes) return new Map<string, number>();
    const { contentScoreById: map } = rankPlacesByContentRelevance(
      likedPlaces,
      [place]
    );
    return map;
  }, [place, likedPlaces, hasLikes]);

  const likedIdsKey = useMemo(
    () =>
      likedPlaces
        .map((p) => p.id)
        .sort()
        .join(','),
    [likedPlaces]
  );

  const ratedIdsKey = useMemo(
    () => Array.from(ratedPlaceIds).sort().join(','),
    [ratedPlaceIds]
  );

  const viewerDietaryPreferenceIds = useMemo(
    () => getDietaryPreferenceIds((userId ?? null) as UserIdT | null),
    [userId]
  );

  const dietaryIdsKey = useMemo(
    () => [...viewerDietaryPreferenceIds].sort().join(','),
    [viewerDietaryPreferenceIds]
  );

  const {
    data: matchSignals,
    isPending: isCollabPending,
    isError: collabError,
  } = useQuery({
    queryKey: [
      'place-match-signals',
      place.id,
      userId ?? 'guest',
      likedIdsKey,
      ratedIdsKey,
      dietaryIdsKey,
    ],
    queryFn: () =>
      fetchPlaceMatchSignals({
        placeId: place.id,
        likedPlaces,
        userId: userId!,
        ratedPlaceIds,
        subjectDietaryPreferenceIds: viewerDietaryPreferenceIds,
      }),
    enabled: enabled && useCollaborative && !!userId && userId !== 'guest_user',
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

  const breakdown = useMemo((): PlaceMatchBreakdown | null => {
    if (!hasLikes) return null;

    const collabMap = new Map<string, number>();
    if (
      useCollaborative &&
      !isCollabPending &&
      !collabError &&
      matchSignals?.collab != null
    ) {
      collabMap.set(place.id, matchSignals.collab);
    }

    const dietaryMap = new Map<string, number>();
    if (
      useCollaborative &&
      !isCollabPending &&
      !collabError &&
      matchSignals?.dietaryPeerScore != null
    ) {
      dietaryMap.set(place.id, matchSignals.dietaryPeerScore);
    }

    const ctx: CompositeRankingContext = {
      userLocation: searchLocation,
      contentScoreById,
      collabScoreById: collabMap,
      viewerDietaryActive: viewerDietaryPreferenceIds.length > 0,
      dietaryScoreById:
        viewerDietaryPreferenceIds.length > 0 ? dietaryMap : undefined,
    };

    return getPlaceMatchBreakdown(place, ctx);
  }, [
    place,
    hasLikes,
    searchLocation,
    contentScoreById,
    useCollaborative,
    isCollabPending,
    collabError,
    matchSignals,
    viewerDietaryPreferenceIds,
  ]);

  return {
    hasLikes,
    breakdown,
    isCollabPending: useCollaborative && isCollabPending,
    isCollabEnabled: useCollaborative,
    collabError,
  };
}
