import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchDietaryPreferencesByUserIds } from '@/api/people/user-api';
import {
  getUsersWhoLikedPlace,
  type UserPlaceLikesDoc,
} from '@/api/places/place-likes-api';
import { normalizeDietaryPreferenceIds } from '@/lib/dietary-preference-options';
import { DEFAULT_LOCATION } from '@/lib/geo';
import type { PlaceRating } from '@/lib/place-preferences';
import {
  buildPlaceToUsersMap,
  type CompositeRankingContext,
  computeDietaryPeerScoresByPlaceId,
  deduplicateByName,
  inferPlaceTypes,
  inferPriceRange,
  mergeWithRrf,
  type RankedPlacesResult,
  rankPlacesByCompositeScore,
  rankPlacesByContentRelevance,
  RECOMMENDATION_FALLBACK_TYPES,
  RRF_K,
  scoreCollaborativeCandidates,
} from '@/lib/recommendation-utils';

import type { Place } from './places-api';
import {
  getPlaceDetailsBatch,
  hasPlacesApiKey,
  isPlacesApiConfigError,
  searchNearbyForRecommendations,
} from './places-api';

const STALE_TIME = 60 * 60 * 1000; // 60 minutes
const GC_TIME = 24 * 60 * 60 * 1000; // 24 hours

/** Exported for `use-place-match` — keep in sync with collaborative pipeline. */
export const MAX_LIKED_PLACES_TO_QUERY = 5;
export const MAX_USERS_PER_PLACE = 50;
const MIN_COLLABORATIVE_IDS = 1;
const MAX_RECOMMENDATION_RESULTS = 20;
const MERGE_WITH_CONTENT_BELOW = 12;
/** Places API (New) allows maxResultCount 1–20 only */
const CONTENT_SEARCH_MAX_RESULTS = 20;
const COLLAB_CANDIDATE_TOP_N = 24;
/** Accumulate candidates across tiers until at least this many unique places. */
const MIN_CONTENT_CANDIDATES = 10;

const REC_DEBUG = '[recommendations:debug]';

function recDebug(message: string, data?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (data !== undefined) {
    console.log(REC_DEBUG, message, data);
  } else {
    console.log(REC_DEBUG, message);
  }
}

export type UserLocation = {
  latitude: number;
  longitude: number;
};

type UseRecommendationsParams = {
  likedPlaces: Place[];
  userLocation: UserLocation | null;
  ratedPlaceIds: Set<string>;
  userId: string | null;
  /** Normalized dietary IDs for peer affinity (local settings / public profile). */
  viewerDietaryPreferenceIds: string[];
  /** Viewer’s ratings (up/neutral/down) — adjusts composite via self-rating multipliers. */
  placeRatings: Record<string, PlaceRating>;
  enabled?: boolean;
};

type ContentSearchTier = {
  types: string[];
  usePriceFilter: boolean;
  radiusMeters: number;
};

function buildContentSearchTiers(likedPlaces: Place[]): ContentSearchTier[] {
  const inferred = inferPlaceTypes(likedPlaces);
  const priceRange = inferPriceRange(likedPlaces);
  const usePrice = !!(priceRange?.length && priceRange.length < 4);

  return [
    { types: inferred, usePriceFilter: usePrice, radiusMeters: 10000 },
    { types: inferred, usePriceFilter: false, radiusMeters: 10000 },
    {
      types: [...RECOMMENDATION_FALLBACK_TYPES],
      usePriceFilter: usePrice,
      radiusMeters: 10000,
    },
    {
      types: [...RECOMMENDATION_FALLBACK_TYPES],
      usePriceFilter: false,
      radiusMeters: 10000,
    },
    { types: inferred, usePriceFilter: false, radiusMeters: 25000 },
    {
      types: [...RECOMMENDATION_FALLBACK_TYPES],
      usePriceFilter: false,
      radiusMeters: 25000,
    },
    { types: [], usePriceFilter: false, radiusMeters: 25000 },
    { types: [], usePriceFilter: false, radiusMeters: 50000 },
  ];
}

function applyPriceFilter(places: Place[], likedPlaces: Place[]): Place[] {
  const priceRange = inferPriceRange(likedPlaces);
  if (!priceRange?.length || priceRange.length >= 4) return places;
  const narrowed = places.filter(
    (p) => !p.priceLevel || priceRange.includes(p.priceLevel)
  );
  return narrowed.length > 0 ? narrowed : places;
}

type ContentBranchResult = {
  places: Place[];
  contentScoreById: Map<string, number>;
};

async function contentBasedRecommendations(
  likedPlaces: Place[],
  searchLocation: { latitude: number; longitude: number },
  ratedPlaceIds: Set<string>
): Promise<ContentBranchResult> {
  const tiers = buildContentSearchTiers(likedPlaces);
  recDebug('contentBasedRecommendations enter (sync, before any fetch)', {
    tierCount: tiers.length,
    hasPlacesApiKey: hasPlacesApiKey(),
  });

  const accumulated = new Map<string, Place>();

  for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
    const tier = tiers[tierIndex];
    const fetchStartedAt = Date.now();
    recDebug('nearby fetch start', {
      tierIndex,
      radiusMeters: tier.radiusMeters,
      includedTypeCount: tier.types.length,
    });
    let raw: Awaited<ReturnType<typeof searchNearbyForRecommendations>>;
    try {
      raw = await searchNearbyForRecommendations(
        {
          latitude: searchLocation.latitude,
          longitude: searchLocation.longitude,
          includedTypes: tier.types,
        },
        {
          radiusMeters: tier.radiusMeters,
          maxResultCount: CONTENT_SEARCH_MAX_RESULTS,
        }
      );
    } catch (err) {
      if (isPlacesApiConfigError(err)) {
        recDebug('nearby fetch FAILED (API key / restriction)', { tierIndex });
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      recDebug('nearby fetch FAILED', { tierIndex, message });
      if (__DEV__) {
        console.error(REC_DEBUG, 'searchNearbyForRecommendations', err);
      }
      throw err;
    }
    recDebug('nearby fetch ok', {
      tierIndex,
      ms: Date.now() - fetchStartedAt,
      rawNearbyCount: raw.length,
    });
    const afterRated = raw.filter((p) => !ratedPlaceIds.has(p.id));
    let filtered = afterRated;
    if (tier.usePriceFilter) {
      filtered = applyPriceFilter(filtered, likedPlaces);
    }
    for (const p of filtered) {
      if (!accumulated.has(p.id)) accumulated.set(p.id, p);
    }
    recDebug('content tier', {
      tierIndex,
      radiusMeters: tier.radiusMeters,
      typeCount: tier.types.length,
      usePriceFilter: tier.usePriceFilter,
      rawNearbyCount: raw.length,
      afterExcludingRated: afterRated.length,
      ratedPlaceIdsSize: ratedPlaceIds.size,
      afterPriceFilterIfApplied: filtered.length,
      accumulatedTotal: accumulated.size,
    });
    if (accumulated.size >= MIN_CONTENT_CANDIDATES) {
      recDebug('content branch hit min candidates', {
        tierIndex,
        accumulatedTotal: accumulated.size,
      });
      break;
    }
  }

  const candidates = deduplicateByName(
    [...accumulated.values()],
    searchLocation
  );

  if (candidates.length > 0) {
    recDebug('content branch ranking', {
      beforeDedup: accumulated.size,
      afterDedup: candidates.length,
    });
    const { ranked, contentScoreById } = rankPlacesByContentRelevance(
      likedPlaces,
      candidates
    );
    return { places: ranked, contentScoreById };
  }

  recDebug('content branch exhausted all tiers — no candidates', {
    tierCount: tiers.length,
  });
  return { places: [], contentScoreById: new Map() };
}

type RunPipelineParams = {
  runId: string;
  contentBranch: ContentBranchResult;
  likedPlaces: Place[];
  searchLocation: { latitude: number; longitude: number };
  /** Actual user location (null when denied); used for distance scoring only. */
  rankingLocation: { latitude: number; longitude: number } | null;
  userId: string | null;
  useCollaborative: boolean;
  ratedPlaceIds: Set<string>;
  viewerDietaryPreferenceIds: string[];
  selfRatingById: Map<string, PlaceRating>;
};

export type RecommendationResult = {
  places: Place[];
  scoreById: Map<string, number>;
};

async function runRecommendationPipeline(
  params: RunPipelineParams
): Promise<RecommendationResult> {
  const {
    runId,
    contentBranch,
    likedPlaces,
    searchLocation,
    rankingLocation,
    userId,
    useCollaborative,
    ratedPlaceIds,
    viewerDietaryPreferenceIds,
    selfRatingById,
  } = params;

  const viewerDiet = normalizeDietaryPreferenceIds(viewerDietaryPreferenceIds);
  let dietaryScoreById = new Map<string, number>();

  const makeRankingCtx = (
    contentScoreById: Map<string, number>,
    collabScoreById: Map<string, number>
  ): CompositeRankingContext => ({
    userLocation: rankingLocation,
    contentScoreById,
    collabScoreById,
    viewerDietaryActive: viewerDiet.length > 0,
    dietaryScoreById: viewerDiet.length > 0 ? dietaryScoreById : undefined,
    viewerDietaryIds: viewerDiet.length > 0 ? viewerDiet : undefined,
    selfRatingById: selfRatingById.size > 0 ? selfRatingById : undefined,
  });

  const finalize = (
    places: Place[],
    contentScoreById: Map<string, number>,
    collabScoreById: Map<string, number>
  ): RecommendationResult => {
    const result: RankedPlacesResult = rankPlacesByCompositeScore(
      places,
      makeRankingCtx(contentScoreById, collabScoreById)
    );
    return {
      places: result.ranked.slice(0, MAX_RECOMMENDATION_RESULTS),
      scoreById: result.scoreById,
    };
  };

  const EMPTY_RESULT: RecommendationResult = {
    places: [],
    scoreById: new Map(),
  };

  if (!useCollaborative) {
    if (contentBranch.places.length === 0) {
      recDebug('return [] — no collaborative user and content branch empty', {
        runId,
        reason: 'guest_user or missing userId',
      });
      return EMPTY_RESULT;
    }
    const out = finalize(
      contentBranch.places,
      contentBranch.contentScoreById,
      new Map()
    );
    recDebug('return (content-only / no collab)', {
      runId,
      resultCount: out.places.length,
    });
    return out;
  }

  const likedIds = new Set(likedPlaces.map((p) => p.id));
  const excludeUserIds = new Set([userId!]);

  const placeIdsToQuery = likedPlaces
    .map((p) => p.id)
    .slice(0, MAX_LIKED_PLACES_TO_QUERY);

  const allDocs: UserPlaceLikesDoc[] = [];
  for (const placeId of placeIdsToQuery) {
    const docs = await getUsersWhoLikedPlace(placeId, MAX_USERS_PER_PLACE);
    allDocs.push(...docs);
  }

  const uniqueByUserId = Array.from(
    new Map(allDocs.map((d) => [d.id, d])).values()
  );

  if (userId && viewerDiet.length > 0) {
    const placeToUsers = buildPlaceToUsersMap(uniqueByUserId, excludeUserIds);
    const peerIds = [...new Set(uniqueByUserId.map((d) => d.id))].filter(
      (id) => id !== userId
    );
    const dietaryByUserId = await fetchDietaryPreferencesByUserIds(peerIds);
    dietaryScoreById = computeDietaryPeerScoresByPlaceId({
      placeToUsers,
      viewerUserId: userId,
      viewerDietaryIds: viewerDiet,
      dietaryByUserId,
    });
  }

  recDebug('collaborative pool', {
    runId,
    seedPlaceIds: placeIdsToQuery,
    totalDocsFromFirestore: allDocs.length,
    uniqueUsersInPool: uniqueByUserId.length,
  });

  const collaborativeScored = scoreCollaborativeCandidates({
    usersWhoLiked: uniqueByUserId,
    seedPlaceIds: placeIdsToQuery,
    currentUserLikedIds: likedIds,
    ratedPlaceIds,
    excludeUserIds,
    topN: COLLAB_CANDIDATE_TOP_N,
  });

  const collabScoreById = new Map(
    collaborativeScored.map((s) => [s.placeId, s.score])
  );

  if (collaborativeScored.length < MIN_COLLABORATIVE_IDS) {
    recDebug('collaborative scored empty or below threshold', {
      runId,
      collaborativeScoredCount: collaborativeScored.length,
      minRequired: MIN_COLLABORATIVE_IDS,
    });
    if (contentBranch.places.length === 0) {
      recDebug('return [] — no collab candidates and content empty', { runId });
      return EMPTY_RESULT;
    }
    const out = finalize(
      contentBranch.places,
      contentBranch.contentScoreById,
      new Map()
    );
    recDebug('return (fallback: collab empty, content only)', {
      runId,
      resultCount: out.places.length,
    });
    return out;
  }

  const orderedIds = collaborativeScored.map((s) => s.placeId);
  const details = await getPlaceDetailsBatch(orderedIds);
  const nullDetailCount = details.filter((d) => d == null).length;
  recDebug('place details batch', {
    runId,
    requestedIds: orderedIds.length,
    nullDetails: nullDetailCount,
  });

  let collaborativePlaces: Place[] = orderedIds
    .map((id, i) => ({ id, place: details[i] }))
    .filter((x): x is { id: string; place: Place } => x.place != null)
    .map((x) => x.place);

  const priceRange = inferPriceRange(likedPlaces);
  if (priceRange?.length && priceRange.length < 4) {
    const beforePrice = collaborativePlaces.length;
    const narrowed = collaborativePlaces.filter(
      (p) => !p.priceLevel || priceRange.includes(p.priceLevel)
    );
    collaborativePlaces = narrowed.length > 0 ? narrowed : collaborativePlaces;
    recDebug('collab price filter', {
      runId,
      inferredRange: priceRange,
      before: beforePrice,
      after: collaborativePlaces.length,
      revertedToUnfiltered: narrowed.length === 0,
    });
  }

  collaborativePlaces = deduplicateByName(collaborativePlaces, searchLocation);
  recDebug('collab dedup', {
    runId,
    afterDedup: collaborativePlaces.length,
  });

  if (collaborativePlaces.length === 0) {
    recDebug('collaborative list empty after details/price', {
      runId,
      contentPlaceCount: contentBranch.places.length,
    });
    if (contentBranch.places.length === 0) {
      recDebug(
        'return [] — all place details failed or filtered and content empty',
        {
          runId,
        }
      );
      return EMPTY_RESULT;
    }
    const out = finalize(
      contentBranch.places,
      contentBranch.contentScoreById,
      new Map()
    );
    recDebug('return (fallback: collab places empty after API)', {
      runId,
      resultCount: out.places.length,
    });
    return out;
  }

  const shouldMergeWithContent =
    contentBranch.places.length > 0 &&
    collaborativePlaces.length < MERGE_WITH_CONTENT_BELOW;

  if (!shouldMergeWithContent) {
    recDebug('finalize collaborative only (no RRF merge)', {
      runId,
      collaborativeCount: collaborativePlaces.length,
      shouldMergeWithContent,
    });
    const out = finalize(
      collaborativePlaces,
      contentBranch.contentScoreById,
      collabScoreById
    );
    recDebug('return (collaborative only)', {
      runId,
      resultCount: out.places.length,
    });
    return out;
  }

  const rrfMerged = mergeWithRrf(
    [collaborativePlaces, contentBranch.places],
    RRF_K,
    MAX_RECOMMENDATION_RESULTS
  );

  recDebug('finalize after RRF merge', {
    runId,
    rrfCount: rrfMerged.length,
  });
  const out = finalize(
    rrfMerged,
    contentBranch.contentScoreById,
    collabScoreById
  );
  recDebug('return (after RRF)', { runId, resultCount: out.places.length });
  return out;
}

function selfRatingRecordToMap(
  record: Record<string, PlaceRating>
): Map<string, PlaceRating> {
  const m = new Map<string, PlaceRating>();
  for (const id of Object.keys(record)) {
    const r = record[id];
    if (r !== undefined) m.set(id, r);
  }
  return m;
}

export function useRecommendations({
  likedPlaces,
  userLocation,
  ratedPlaceIds,
  userId,
  viewerDietaryPreferenceIds,
  placeRatings,
  enabled = true,
}: UseRecommendationsParams) {
  const hasLikes = likedPlaces.length > 0;
  const searchLocation = userLocation ?? DEFAULT_LOCATION;
  const useCollaborative =
    !!userId && userId !== 'guest_user' && likedPlaces.length > 0;

  const ratedIdsKey = useMemo(
    () => Array.from(ratedPlaceIds).sort().join(','),
    [ratedPlaceIds]
  );

  const dietaryIdsKey = useMemo(
    () => [...viewerDietaryPreferenceIds].sort().join(','),
    [viewerDietaryPreferenceIds]
  );

  const placeRatingsKey = useMemo(
    () =>
      Object.keys(placeRatings)
        .sort()
        .map((id) => `${id}:${placeRatings[id]}`)
        .join(','),
    [placeRatings]
  );

  return useQuery({
    queryKey: [
      'recommendations',
      likedPlaces
        .map((p) => p.id)
        .sort()
        .join(','),
      ratedIdsKey,
      dietaryIdsKey,
      placeRatingsKey,
      searchLocation.latitude,
      searchLocation.longitude,
      userId ?? 'guest',
    ],
    queryFn: async (): Promise<RecommendationResult> => {
      if (!hasLikes) return { places: [], scoreById: new Map() };

      const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      recDebug('queryFn start', {
        runId,
        likedCount: likedPlaces.length,
        searchLocation,
        userId: userId ?? '(null)',
        useCollaborative,
        ratedPlaceIdsSize: ratedPlaceIds.size,
      });

      try {
        const contentBranch = await contentBasedRecommendations(
          likedPlaces,
          searchLocation,
          ratedPlaceIds
        );

        recDebug('after content branch', {
          runId,
          contentPlaceCount: contentBranch.places.length,
        });

        return await runRecommendationPipeline({
          runId,
          contentBranch,
          likedPlaces,
          searchLocation,
          rankingLocation: userLocation ?? null,
          userId,
          useCollaborative,
          ratedPlaceIds,
          viewerDietaryPreferenceIds,
          selfRatingById: selfRatingRecordToMap(placeRatings),
        });
      } catch (err) {
        if (isPlacesApiConfigError(err)) {
          recDebug('queryFn Places API config error', { runId });
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        recDebug('queryFn ERROR (rethrowing)', { runId, message });
        if (__DEV__) {
          console.error(REC_DEBUG, 'useRecommendations queryFn', err);
        }
        throw err;
      }
    },
    enabled: enabled && hasPlacesApiKey() && hasLikes,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}
