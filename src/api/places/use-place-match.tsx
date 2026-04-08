import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchPlaceMatchSignals } from '@/api/places/compute-match-for-subject';
import type { Place } from '@/api/places/places-api';
import { useUserSettings } from '@/lib/hooks/use-user-settings';
import type { PlaceRating } from '@/lib/place-preferences';
import {
  type CompositeRankingContext,
  getPlaceMatchBreakdown,
  type PlaceMatchBreakdown,
  rankPlacesByContentRelevance,
} from '@/lib/recommendation-utils';

const STALE_TIME = 60 * 60 * 1000;
const GC_TIME = 24 * 60 * 60 * 1000;

export type UsePlaceMatchParams = {
  place: Place;
  likedPlaces: Place[];
  userLocation: { latitude: number; longitude: number } | null;
  userId: string | null;
  ratedPlaceIds: Set<string>;
  placeRating?: PlaceRating;
  enabled?: boolean;
};

export type UsePlaceMatchResult = {
  hasLikes: boolean;
  breakdown: PlaceMatchBreakdown | null;
  isCollabPending: boolean;
  isCollabEnabled: boolean;
  collabError: boolean;
  /** True while collaborative signals are fetching or refetching */
  isMatchSignalsFetching: boolean;
};

export function usePlaceMatch({
  place,
  likedPlaces,
  userLocation,
  userId,
  ratedPlaceIds,
  placeRating,
  enabled = true,
}: UsePlaceMatchParams): UsePlaceMatchResult {
  const hasLikes = likedPlaces.length > 0;

  const profilePlaces = useMemo(
    () => likedPlaces.filter((p) => p.id !== place.id),
    [likedPlaces, place.id]
  );

  const hasProfile = profilePlaces.length > 0;
  const useCollaborative = !!userId && userId !== 'guest_user' && hasProfile;

  const contentScoreById = useMemo(() => {
    if (!hasProfile) return new Map<string, number>();
    const { contentScoreById: map } = rankPlacesByContentRelevance(
      profilePlaces,
      [place]
    );
    return map;
  }, [place, profilePlaces, hasProfile]);

  const profileIdsKey = useMemo(
    () =>
      profilePlaces
        .map((p) => p.id)
        .sort()
        .join(','),
    [profilePlaces]
  );

  const ratedIdsExcludingSelf = useMemo(() => {
    const ids = new Set(ratedPlaceIds);
    ids.delete(place.id);
    return ids;
  }, [ratedPlaceIds, place.id]);

  const ratedIdsKey = useMemo(
    () => Array.from(ratedIdsExcludingSelf).sort().join(','),
    [ratedIdsExcludingSelf]
  );

  const { dietaryPreferenceIds: viewerDietaryPreferenceIds } =
    useUserSettings();

  const dietaryIdsKey = useMemo(
    () => [...viewerDietaryPreferenceIds].sort().join(','),
    [viewerDietaryPreferenceIds]
  );

  const selfRatingById = useMemo((): Map<string, PlaceRating> | undefined => {
    if (placeRating === undefined) return undefined;
    return new Map([[place.id, placeRating]]);
  }, [place.id, placeRating]);

  const {
    data: matchSignals,
    isPending: isCollabPending,
    isFetching: isMatchSignalsFetching,
    isError: collabError,
  } = useQuery({
    queryKey: [
      'place-match-signals',
      place.id,
      userId ?? 'guest',
      profileIdsKey,
      ratedIdsKey,
      dietaryIdsKey,
    ],
    queryFn: () =>
      fetchPlaceMatchSignals({
        placeId: place.id,
        likedPlaces: profilePlaces,
        userId: userId!,
        ratedPlaceIds: ratedIdsExcludingSelf,
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
      userLocation,
      contentScoreById,
      collabScoreById: collabMap,
      viewerDietaryActive: viewerDietaryPreferenceIds.length > 0,
      dietaryScoreById:
        viewerDietaryPreferenceIds.length > 0 ? dietaryMap : undefined,
      viewerDietaryIds:
        viewerDietaryPreferenceIds.length > 0
          ? viewerDietaryPreferenceIds
          : undefined,
      selfRatingById,
    };

    return getPlaceMatchBreakdown(place, ctx);
  }, [
    place,
    hasLikes,
    userLocation,
    contentScoreById,
    useCollaborative,
    isCollabPending,
    collabError,
    matchSignals,
    viewerDietaryPreferenceIds,
    selfRatingById,
  ]);

  return {
    hasLikes,
    breakdown,
    isCollabPending: useCollaborative && isCollabPending,
    isCollabEnabled: useCollaborative,
    collabError,
    isMatchSignalsFetching: useCollaborative && isMatchSignalsFetching,
  };
}
