import {
  getUsersWhoLikedPlace,
  type UserPlaceLikesDoc,
} from '@/api/places/place-likes-api';
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

export type FetchCollaborativeScoreParams = {
  placeId: string;
  likedPlaces: Place[];
  userId: string;
  ratedPlaceIds: Set<string>;
};

export async function fetchCollaborativeScoreForPlace(
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
  return raw ?? null;
}

export type ComputeMatchForSubjectParams = {
  place: Place;
  subjectUserId: string;
  likedPlaces: Place[];
  userLocation: { latitude: number; longitude: number };
  ratedPlaceIds: Set<string>;
};

export async function computeMatchForSubject(
  params: ComputeMatchForSubjectParams
): Promise<{ composite: number; breakdown: PlaceMatchBreakdown } | null> {
  const { place, subjectUserId, likedPlaces, userLocation, ratedPlaceIds } =
    params;
  if (likedPlaces.length === 0) return null;

  const { contentScoreById } = rankPlacesByContentRelevance(likedPlaces, [
    place,
  ]);

  const collab = await fetchCollaborativeScoreForPlace({
    placeId: place.id,
    likedPlaces,
    userId: subjectUserId,
    ratedPlaceIds,
  });

  const collabMap = new Map<string, number>();
  if (collab != null) collabMap.set(place.id, collab);

  const ctx: CompositeRankingContext = {
    userLocation,
    contentScoreById,
    collabScoreById: collabMap,
  };

  const breakdown = getPlaceMatchBreakdown(place, ctx);
  return { composite: breakdown.composite, breakdown };
}

/** Composite match using quality, distance, and content only (no collaborative CF). */
export function computePlaceMatchBreakdownContentOnly(
  place: Place,
  likedPlaces: Place[],
  userLocation: { latitude: number; longitude: number }
): PlaceMatchBreakdown | null {
  if (likedPlaces.length === 0) return null;

  const { contentScoreById } = rankPlacesByContentRelevance(likedPlaces, [
    place,
  ]);

  const ctx: CompositeRankingContext = {
    userLocation,
    contentScoreById,
    collabScoreById: new Map(),
  };

  return getPlaceMatchBreakdown(place, ctx);
}
