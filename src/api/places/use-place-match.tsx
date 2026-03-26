import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  getUsersWhoLikedPlace,
  type UserPlaceLikesDoc,
} from '@/api/places/place-likes-api';
import { DEFAULT_LOCATION } from '@/lib/geo';
import {
  collaborativeScoreForPlaceId,
  type CompositeRankingContext,
  getPlaceMatchBreakdown,
  type PlaceMatchBreakdown,
  rankPlacesByContentRelevance,
} from '@/lib/recommendation-utils';

import type { Place } from './places-api';
import {
  MAX_LIKED_PLACES_TO_QUERY,
  MAX_USERS_PER_PLACE,
} from './use-recommendations';

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

type FetchCollaborativeScoreParams = {
  placeId: string;
  likedPlaces: Place[];
  userId: string;
  ratedPlaceIds: Set<string>;
};

async function fetchCollaborativeScoreForPlace(
  params: FetchCollaborativeScoreParams
): Promise<number | null> {
  const { placeId, likedPlaces, userId, ratedPlaceIds } = params;
  const placeIdsToQuery = likedPlaces
    .map((p) => p.id)
    .slice(0, MAX_LIKED_PLACES_TO_QUERY);

  const allDocs: UserPlaceLikesDoc[] = [];
  for (const pid of placeIdsToQuery) {
    const docs = await getUsersWhoLikedPlace(pid, MAX_USERS_PER_PLACE);
    allDocs.push(...docs);
  }

  const uniqueByUserId = Array.from(
    new Map(allDocs.map((d) => [d.id, d])).values()
  );

  const likedIds = new Set(likedPlaces.map((p) => p.id));
  const raw = collaborativeScoreForPlaceId({
    usersWhoLiked: uniqueByUserId,
    seedPlaceIds: placeIdsToQuery,
    candidatePlaceId: placeId,
    currentUserLikedIds: likedIds,
    ratedPlaceIds,
    excludeUserIds: new Set([userId]),
  });
  /** TanStack Query forbids `undefined` as successful query data. */
  return raw ?? null;
}

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
