import { useQueries } from '@tanstack/react-query';

import { fetchGroup } from '@/api/groups/use-groups';
import { fetchUser } from '@/api/people/use-users';
import {
  computeMatchForSubject,
  computePlaceMatchBreakdownContentOnly,
} from '@/api/places/compute-match-for-subject';
import { getPlaceLikesForUser } from '@/api/places/place-likes-api';
import { getPlaceDetailsBatch, hasPlacesApiKey } from '@/api/places/places-api';
import { normalizeDietaryPreferenceIds } from '@/lib/dietary-preference-options';
import { meanOfNumbers } from '@/lib/mean-group-score';
import type { GroupIdT, UserIdT } from '@/types';

import type { Place } from './places-api';
import { MAX_LIKED_PLACES_TO_QUERY } from './use-recommendations';

const STALE_TIME = 60 * 60 * 1000;
const GC_TIME = 24 * 60 * 60 * 1000;

export const MAX_FRIENDS_TO_SCORE = 10;
export const MAX_GROUPS_TO_SCORE = 10;
export const TOP_SOCIAL_MATCH = 3;

export type FriendPlaceMatchRow = {
  id: UserIdT;
  displayName: string;
  composite: number;
};

export type GroupPlaceMatchRow = {
  id: GroupIdT;
  name: string;
  composite: number;
};

type UsePlaceSocialMatchParams = {
  place: Place;
  viewerUserId: string | null;
  friendUserIds: UserIdT[];
  groupIds: GroupIdT[];
  userLocation: { latitude: number; longitude: number } | null;
  enabled: boolean;
};

export type UsePlaceSocialMatchResult = {
  friendRows: FriendPlaceMatchRow[];
  groupRows: GroupPlaceMatchRow[];
  isFriendsPending: boolean;
  isGroupsPending: boolean;
  isAnyPending: boolean;
};

async function fetchFriendPlaceMatch(params: {
  place: Place;
  friendId: UserIdT;
  userLocation: { latitude: number; longitude: number } | null;
  viewerUserId: string | null;
}): Promise<FriendPlaceMatchRow | null> {
  const { place, friendId, userLocation, viewerUserId } = params;
  if (!userLocation) return null;

  const rawIds = await getPlaceLikesForUser(friendId);
  if (rawIds.length === 0) return null;

  const capped = rawIds.slice(0, MAX_LIKED_PLACES_TO_QUERY);
  const details = await getPlaceDetailsBatch(capped);
  const likedPlaces = details.filter((p): p is Place => p != null);
  if (likedPlaces.length === 0) return null;

  let displayName = 'Unknown';
  let subjectDietaryPreferenceIds: string[] = [];
  try {
    const user = await fetchUser(friendId);
    displayName = user.displayName?.trim() || 'Unknown';
    subjectDietaryPreferenceIds = normalizeDietaryPreferenceIds(
      user.dietaryPreferences ?? []
    );
  } catch (err) {
    if (__DEV__) {
      console.error('[place-social-match] fetchUser failed', {
        friendId,
        viewerUserId,
        err,
      });
    }
  }

  const match = await computeMatchForSubject({
    place,
    subjectUserId: friendId,
    likedPlaces,
    userLocation,
    ratedPlaceIds: new Set(),
    subjectDietaryPreferenceIds,
  });
  if (!match) return null;

  return {
    id: friendId,
    displayName,
    composite: match.composite,
  };
}

async function fetchGroupPlaceMatch(params: {
  place: Place;
  groupId: GroupIdT;
  userLocation: { latitude: number; longitude: number } | null;
}): Promise<GroupPlaceMatchRow | null> {
  const { place, groupId, userLocation } = params;
  if (!userLocation) return null;

  const group = await fetchGroup(groupId);
  const composites: number[] = [];

  for (const memberId of group.members) {
    const rawIds = await getPlaceLikesForUser(memberId);
    if (rawIds.length === 0) continue;

    const capped = rawIds.slice(0, MAX_LIKED_PLACES_TO_QUERY);
    const details = await getPlaceDetailsBatch(capped);
    const likedPlaces = details.filter((p): p is Place => p != null);
    if (likedPlaces.length === 0) continue;

    const breakdown = computePlaceMatchBreakdownContentOnly(
      place,
      likedPlaces,
      userLocation
    );
    if (breakdown) composites.push(breakdown.composite);
  }

  const mean = meanOfNumbers(composites);
  if (mean == null) return null;

  return {
    id: groupId,
    name: group.name,
    composite: mean,
  };
}

export function usePlaceSocialMatch({
  place,
  viewerUserId,
  friendUserIds,
  groupIds,
  userLocation,
  enabled,
}: UsePlaceSocialMatchParams): UsePlaceSocialMatchResult {
  const loc = userLocation ?? null;
  const canRun = enabled && hasPlacesApiKey() && loc != null;

  const cappedFriendIds = friendUserIds.slice(0, MAX_FRIENDS_TO_SCORE);
  const cappedGroupIds = groupIds.slice(0, MAX_GROUPS_TO_SCORE);

  const friendQueries = useQueries({
    queries: cappedFriendIds.map((friendId) => ({
      queryKey: ['place-social-match', 'friend', friendId, place.id] as const,
      queryFn: () => {
        if (loc == null) return Promise.resolve(null);
        return fetchFriendPlaceMatch({
          place,
          friendId,
          userLocation: loc,
          viewerUserId,
        });
      },
      enabled: canRun && cappedFriendIds.length > 0,
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
    })),
  });

  const groupQueries = useQueries({
    queries: cappedGroupIds.map((groupId) => ({
      queryKey: ['place-social-match', 'group', groupId, place.id] as const,
      queryFn: () => {
        if (loc == null) return Promise.resolve(null);
        return fetchGroupPlaceMatch({ place, groupId, userLocation: loc });
      },
      enabled: canRun && cappedGroupIds.length > 0,
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
    })),
  });

  const friendRows: FriendPlaceMatchRow[] = friendQueries
    .map((q) => q.data)
    .filter((r): r is FriendPlaceMatchRow => r != null)
    .sort((a, b) => b.composite - a.composite)
    .slice(0, TOP_SOCIAL_MATCH);

  const groupRows: GroupPlaceMatchRow[] = groupQueries
    .map((q) => q.data)
    .filter((r): r is GroupPlaceMatchRow => r != null)
    .sort((a, b) => b.composite - a.composite)
    .slice(0, TOP_SOCIAL_MATCH);

  const isFriendsPending =
    canRun &&
    cappedFriendIds.length > 0 &&
    friendQueries.some((q) => q.isPending);
  const isGroupsPending =
    canRun &&
    cappedGroupIds.length > 0 &&
    groupQueries.some((q) => q.isPending);

  return {
    friendRows,
    groupRows,
    isFriendsPending,
    isGroupsPending,
    isAnyPending: isFriendsPending || isGroupsPending,
  };
}
