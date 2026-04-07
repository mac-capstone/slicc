import { fetchPublicDietaryPreferencesByUserIds } from '@/api/people/user-api';
import {
  getUsersWhoLikedPlace,
  type UserPlaceLikesDoc,
} from '@/api/places/place-likes-api';
import { normalizeDietaryPreferenceIds } from '@/lib/dietary-preference-options';
import {
  buildPlaceToUsersMap,
  collaborativeScoreForPlaceId,
  type CompositeRankingContext,
  computeDietaryPeerScoresByPlaceId,
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

export type FetchPlaceMatchSignalsParams = FetchCollaborativeScoreParams & {
  /** Dietary IDs of the subject (place viewer on own screen; friend when scoring friends). */
  subjectDietaryPreferenceIds: string[];
};

export type PlaceMatchSignals = {
  collab: number | null;
  /** Present when viewer has dietary prefs and peers supply a score. */
  dietaryPeerScore: number | null;
};

async function loadLikesPoolForMatch(likedPlaces: Place[]): Promise<{
  placeIdsToQuery: string[];
  uniqueByUserId: UserPlaceLikesDoc[];
}> {
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
  return { placeIdsToQuery, uniqueByUserId };
}

export async function fetchCollaborativeScoreForPlace(
  params: FetchCollaborativeScoreParams
): Promise<number | null> {
  const { placeId, likedPlaces, userId, ratedPlaceIds } = params;
  const { placeIdsToQuery, uniqueByUserId } =
    await loadLikesPoolForMatch(likedPlaces);

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

/**
 * Collaborative similarity plus optional peer dietary affinity (one Firestore pool fetch).
 */
export async function fetchPlaceMatchSignals(
  params: FetchPlaceMatchSignalsParams
): Promise<PlaceMatchSignals> {
  const {
    placeId,
    likedPlaces,
    userId,
    ratedPlaceIds,
    subjectDietaryPreferenceIds,
  } = params;
  const { placeIdsToQuery, uniqueByUserId } =
    await loadLikesPoolForMatch(likedPlaces);

  const likedIds = new Set(likedPlaces.map((p) => p.id));
  const raw = collaborativeScoreForPlaceId({
    usersWhoLiked: uniqueByUserId,
    seedPlaceIds: placeIdsToQuery,
    candidatePlaceId: placeId,
    currentUserLikedIds: likedIds,
    ratedPlaceIds,
    excludeUserIds: new Set([userId]),
  });
  const collab = raw ?? null;

  const subjectDiet = normalizeDietaryPreferenceIds(
    subjectDietaryPreferenceIds
  );
  let dietaryPeerScore: number | null = null;
  if (subjectDiet.length > 0) {
    const placeToUsers = buildPlaceToUsersMap(
      uniqueByUserId,
      new Set([userId])
    );
    const peerIds = [...new Set(uniqueByUserId.map((d) => d.id))].filter(
      (id) => id !== userId
    );
    const dietaryByUserId =
      await fetchPublicDietaryPreferencesByUserIds(peerIds);
    const peerMap = computeDietaryPeerScoresByPlaceId({
      placeToUsers,
      viewerUserId: userId,
      viewerDietaryIds: subjectDiet,
      dietaryByUserId,
    });
    const d = peerMap.get(placeId);
    if (d !== undefined) dietaryPeerScore = d;
  }

  return { collab, dietaryPeerScore };
}

export type ComputeMatchForSubjectParams = {
  place: Place;
  subjectUserId: string;
  likedPlaces: Place[];
  userLocation: { latitude: number; longitude: number } | null;
  ratedPlaceIds: Set<string>;
  subjectDietaryPreferenceIds: string[];
};

export async function computeMatchForSubject(
  params: ComputeMatchForSubjectParams
): Promise<{ composite: number; breakdown: PlaceMatchBreakdown } | null> {
  const {
    place,
    subjectUserId,
    likedPlaces,
    userLocation,
    ratedPlaceIds,
    subjectDietaryPreferenceIds,
  } = params;
  if (likedPlaces.length === 0) return null;

  const { contentScoreById } = rankPlacesByContentRelevance(likedPlaces, [
    place,
  ]);

  const signals = await fetchPlaceMatchSignals({
    placeId: place.id,
    likedPlaces,
    userId: subjectUserId,
    ratedPlaceIds,
    subjectDietaryPreferenceIds,
  });

  const collabMap = new Map<string, number>();
  if (signals.collab != null) collabMap.set(place.id, signals.collab);

  const subjectDiet = normalizeDietaryPreferenceIds(
    subjectDietaryPreferenceIds
  );
  const dietaryMap = new Map<string, number>();
  if (signals.dietaryPeerScore !== null) {
    dietaryMap.set(place.id, signals.dietaryPeerScore);
  }

  const ctx: CompositeRankingContext = {
    userLocation,
    contentScoreById,
    collabScoreById: collabMap,
    viewerDietaryActive: subjectDiet.length > 0,
    dietaryScoreById: subjectDiet.length > 0 ? dietaryMap : undefined,
    viewerDietaryIds: subjectDiet.length > 0 ? subjectDiet : undefined,
  };

  const breakdown = getPlaceMatchBreakdown(place, ctx);
  return { composite: breakdown.composite, breakdown };
}

/** Composite match using quality, distance, and content only (no collaborative CF). */
export function computePlaceMatchBreakdownContentOnly(
  place: Place,
  likedPlaces: Place[],
  userLocation: { latitude: number; longitude: number } | null
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
