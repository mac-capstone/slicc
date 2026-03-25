import { useQuery } from '@tanstack/react-query';

import {
  getUsersWhoLikedPlace,
  type UserPlaceLikesDoc,
} from '@/api/places/place-likes-api';
import { DEFAULT_LOCATION } from '@/lib/geo';
import {
  inferPlaceTypes,
  inferPriceRange,
  mergeWithRrf,
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
  searchNearbyForRecommendations,
} from './places-api';

const STALE_TIME = 60 * 60 * 1000; // 60 minutes
const GC_TIME = 24 * 60 * 60 * 1000; // 24 hours

const MAX_LIKED_PLACES_TO_QUERY = 5;
const MAX_USERS_PER_PLACE = 50;
const MIN_COLLABORATIVE_IDS = 1;
const MAX_RECOMMENDATION_RESULTS = 20;
const MERGE_WITH_CONTENT_BELOW = 12;
/** Places API (New) allows maxResultCount 1–20 only */
const CONTENT_SEARCH_MAX_RESULTS = 20;
const COLLAB_CANDIDATE_TOP_N = 24;

/** TEMP: remove after debugging empty recommendation lists */
const REC_DEBUG = '[recommendations:debug]';

function recDebug(message: string, data?: Record<string, unknown>): void {
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
    { types: inferred, usePriceFilter: usePrice, radiusMeters: 5000 },
    { types: inferred, usePriceFilter: false, radiusMeters: 5000 },
    {
      types: [...RECOMMENDATION_FALLBACK_TYPES],
      usePriceFilter: usePrice,
      radiusMeters: 5000,
    },
    {
      types: [...RECOMMENDATION_FALLBACK_TYPES],
      usePriceFilter: false,
      radiusMeters: 5000,
    },
    { types: inferred, usePriceFilter: false, radiusMeters: 15000 },
    {
      types: [...RECOMMENDATION_FALLBACK_TYPES],
      usePriceFilter: false,
      radiusMeters: 15000,
    },
    /** No type filter — supported Nearby types from likes can still return 0 rows. */
    { types: [], usePriceFilter: false, radiusMeters: 15000 },
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
      const message = err instanceof Error ? err.message : String(err);
      recDebug('nearby fetch FAILED', { tierIndex, message });
      console.error(REC_DEBUG, 'searchNearbyForRecommendations', err);
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
    recDebug('content tier', {
      tierIndex,
      radiusMeters: tier.radiusMeters,
      typeCount: tier.types.length,
      usePriceFilter: tier.usePriceFilter,
      rawNearbyCount: raw.length,
      afterExcludingRated: afterRated.length,
      ratedPlaceIdsSize: ratedPlaceIds.size,
      afterPriceFilterIfApplied: filtered.length,
    });
    if (filtered.length > 0) {
      recDebug('content branch hit', { tierIndex });
      const { ranked, contentScoreById } = rankPlacesByContentRelevance(
        likedPlaces,
        filtered
      );
      return { places: ranked, contentScoreById };
    }
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
  userId: string | null;
  useCollaborative: boolean;
  ratedPlaceIds: Set<string>;
};

async function runRecommendationPipeline(
  params: RunPipelineParams
): Promise<Place[]> {
  const {
    runId,
    contentBranch,
    likedPlaces,
    searchLocation,
    userId,
    useCollaborative,
    ratedPlaceIds,
  } = params;

  const finalize = (
    places: Place[],
    contentScoreById: Map<string, number>,
    collabScoreById: Map<string, number>
  ): Place[] =>
    rankPlacesByCompositeScore(places, {
      userLocation: searchLocation,
      contentScoreById,
      collabScoreById,
    }).slice(0, MAX_RECOMMENDATION_RESULTS);

  if (!useCollaborative) {
    if (contentBranch.places.length === 0) {
      recDebug('return [] — no collaborative user and content branch empty', {
        runId,
        reason: 'guest_user or missing userId',
      });
      return [];
    }
    const out = finalize(
      contentBranch.places,
      contentBranch.contentScoreById,
      new Map()
    );
    recDebug('return (content-only / no collab)', {
      runId,
      resultCount: out.length,
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
      return [];
    }
    const out = finalize(
      contentBranch.places,
      contentBranch.contentScoreById,
      new Map()
    );
    recDebug('return (fallback: collab empty, content only)', {
      runId,
      resultCount: out.length,
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
      return [];
    }
    const out = finalize(
      contentBranch.places,
      contentBranch.contentScoreById,
      new Map()
    );
    recDebug('return (fallback: collab places empty after API)', {
      runId,
      resultCount: out.length,
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
    recDebug('return (collaborative only)', { runId, resultCount: out.length });
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
  recDebug('return (after RRF)', { runId, resultCount: out.length });
  return out;
}

export function useRecommendations({
  likedPlaces,
  userLocation,
  ratedPlaceIds,
  userId,
  enabled = true,
}: UseRecommendationsParams) {
  const hasLikes = likedPlaces.length > 0;
  const searchLocation = userLocation ?? DEFAULT_LOCATION;
  const useCollaborative =
    !!userId && userId !== 'guest_user' && likedPlaces.length > 0;

  return useQuery({
    queryKey: [
      'recommendations',
      likedPlaces
        .map((p) => p.id)
        .sort()
        .join(','),
      searchLocation.latitude,
      searchLocation.longitude,
      userId ?? 'guest',
    ],
    queryFn: async (): Promise<Place[]> => {
      if (!hasLikes) return [];

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
          userId,
          useCollaborative,
          ratedPlaceIds,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        recDebug('queryFn ERROR (rethrowing)', { runId, message });
        console.error(REC_DEBUG, 'useRecommendations queryFn', err);
        throw err;
      }
    },
    enabled: enabled && hasPlacesApiKey() && hasLikes,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}
