import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchCollaborativeScoreForPlace } from '@/api/places/compute-match-for-subject';
import { DEFAULT_LOCATION } from '@/lib/geo';
import {
  type CompositeRankingContext,
  getPlaceMatchBreakdown,
  type PlaceMatchBreakdown,
  rankPlacesByContentRelevance,
} from '@/lib/recommendation-utils';

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

  const {
    data: collabScore,
    isPending: isCollabPending,
    isError: collabError,
  } = useQuery({
    queryKey: [
      'place-match-collab',
      place.id,
      userId ?? 'guest',
      likedIdsKey,
      ratedIdsKey,
    ],
    queryFn: () =>
      fetchCollaborativeScoreForPlace({
        placeId: place.id,
        likedPlaces,
        userId: userId!,
        ratedPlaceIds,
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
      collabScore != null
    ) {
      collabMap.set(place.id, collabScore);
    }

    const ctx: CompositeRankingContext = {
      userLocation: searchLocation,
      contentScoreById,
      collabScoreById: collabMap,
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
    collabScore,
  ]);

  return {
    hasLikes,
    breakdown,
    isCollabPending: useCollaborative && isCollabPending,
    isCollabEnabled: useCollaborative,
    collabError,
  };
}
