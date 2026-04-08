import type { UserPlaceLikesDoc } from '@/api/places/place-likes-api';
import type { Place, PriceLevel } from '@/api/places/places-api';
import { normalizeDietaryPreferenceIds } from '@/lib/dietary-preference-options';
import { haversineDistance } from '@/lib/geo';
import type { PlaceRating } from '@/lib/place-preferences';

/**
 * Broad types when inferred types return no nearby results (sparse area) or when
 * liked places use primary types not accepted by Nearby Search `includedTypes`.
 */
export const RECOMMENDATION_FALLBACK_TYPES = [
  'restaurant',
  'cafe',
  'bar',
  'bakery',
  'meal_takeaway',
  'fast_food_restaurant',
] as const;

const DEFAULT_TYPES = [...RECOMMENDATION_FALLBACK_TYPES];
const MAX_TYPES = 3;

/**
 * Meta / "Table B" types the Places API returns on places but rejects
 * when used as `includedTypes` in Nearby Search requests.
 */
const UNSUPPORTED_INCLUDED_TYPES = new Set([
  'point_of_interest',
  'establishment',
  'food',
  'store',
  'health',
  'political',
  'locality',
  'sublocality',
  'route',
  'street_address',
  'premise',
  'subpremise',
  'floor',
  'room',
  'post_box',
  'postal_code',
  'postal_town',
  'geocode',
  'natural_feature',
  'country',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'colloquial_area',
  'neighborhood',
]);

/** RRF constant k (rank fusion); common default ~60 */
export const RRF_K = 60;

/** Legacy 3-factor weights when the viewer has no dietary preferences. */
const W_LEGACY_QUALITY = 0.35;
const W_LEGACY_DISTANCE = 0.3;
const W_LEGACY_PERSONAL = 0.35;

/** 4-factor weights (viewer has dietary prefs). Peer dietary term may still be omitted per place. */
const W4_QUALITY = 0.3;
const W4_DISTANCE = 0.25;
const W4_PERSONAL = 0.3;
const W4_DIETARY = 0.15;

const W4_SUM_THREE = W4_QUALITY + W4_DISTANCE + W4_PERSONAL;

/** When viewer tracks dietary prefs but a place has no peer dietary signal: reweight first three to sum to 1. */
const W3_FROM4_QUALITY = W4_QUALITY / W4_SUM_THREE;
const W3_FROM4_DISTANCE = W4_DISTANCE / W4_SUM_THREE;
const W3_FROM4_PERSONAL = W4_PERSONAL / W4_SUM_THREE;

/** Baseline 3-factor export (no dietary dimension). */
export const COMPOSITE_WEIGHTS = {
  quality: W_LEGACY_QUALITY,
  distance: W_LEGACY_DISTANCE,
  personalization: W_LEGACY_PERSONAL,
} as const;

/** Full 4-factor weights when dietary peer data applies. */
export const COMPOSITE_WEIGHTS_WITH_DIETARY = {
  quality: W4_QUALITY,
  distance: W4_DISTANCE,
  personalization: W4_PERSONAL,
  dietary: W4_DIETARY,
} as const;

/** Proportional self-rating multipliers applied to the composite score. */
export const SELF_RATING_MULTIPLIER_UP = 1.1;
export const SELF_RATING_MULTIPLIER_NEUTRAL = 0.95;
export const SELF_RATING_MULTIPLIER_DOWN = 0.8;

/** Bayesian prior for star ratings when review count is low */
const BAYESIAN_PRIOR_RATING = 3.5;
const BAYESIAN_PRIOR_WEIGHT = 8;

/** Distance decay scale (km); smaller = stronger preference for nearby */
const DISTANCE_DECAY_KM = 30;

/** Google Place types that directly indicate a dietary category. */
const PLACE_TYPE_TO_DIETARY: Record<string, string> = {
  halal_restaurant: 'halal',
  vegetarian_restaurant: 'vegetarian',
  vegan_restaurant: 'vegan',
};

/**
 * Fraction of the viewer's dietary preferences satisfied by the place's Google types.
 * Returns 0 when no types match or the viewer has no dietary preferences.
 */
export function placeTypeDietaryScore(
  place: Place,
  viewerDietaryIds: string[]
): number {
  if (viewerDietaryIds.length === 0) return 0;
  const viewerSet = new Set(viewerDietaryIds);
  const types = getPlaceTypeTerms(place);
  let matched = 0;
  for (const t of types) {
    const diet = PLACE_TYPE_TO_DIETARY[t];
    if (diet && viewerSet.has(diet)) matched++;
  }
  return matched > 0 ? matched / viewerSet.size : 0;
}

/**
 * Keep only one instance per displayName (case-insensitive), preferring the
 * location closest to the user. Prevents chains from dominating the list.
 */
export function deduplicateByName(
  places: Place[],
  userLocation: { latitude: number; longitude: number }
): Place[] {
  const groups = new Map<string, Place>();
  const distances = new Map<string, number>();
  for (const p of places) {
    const key = p.displayName.trim().toLowerCase();
    const dist = p.location
      ? haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          p.location.latitude,
          p.location.longitude
        )
      : Infinity;
    const existing = distances.get(key);
    if (existing === undefined || dist < existing) {
      groups.set(key, p);
      distances.set(key, dist);
    }
  }
  return [...groups.values()];
}

export function getSelfRatingMultiplier(
  rating: PlaceRating | undefined
): number {
  if (rating === 'up') return SELF_RATING_MULTIPLIER_UP;
  if (rating === 'neutral') return SELF_RATING_MULTIPLIER_NEUTRAL;
  if (rating === 'down') return SELF_RATING_MULTIPLIER_DOWN;
  return 1;
}

/**
 * Extract a usable place type from a Place (primaryType or first from types).
 */
function extractType(place: Place): string | null {
  if (place.primaryType) return place.primaryType;
  return place.types?.[0] ?? null;
}

/**
 * All type terms for TF-IDF / cosine (primary + secondary types, deduped).
 */
export function getPlaceTypeTerms(place: Place): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (place.primaryType) {
    seen.add(place.primaryType);
    out.push(place.primaryType);
  }
  if (place.types) {
    for (const t of place.types) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  if (out.length === 0) {
    const one = extractType(place);
    if (one) out.push(one);
  }
  return out;
}

/**
 * Infer top 2-3 place types from liked places for use in includedTypes.
 */
export function inferPlaceTypes(likedPlaces: Place[]): string[] {
  const counts: Record<string, number> = {};
  for (const place of likedPlaces) {
    const type = extractType(place);
    if (type && !UNSUPPORTED_INCLUDED_TYPES.has(type)) {
      counts[type] = (counts[type] ?? 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, MAX_TYPES).map(([t]) => t);
  return top.length > 0 ? top : DEFAULT_TYPES;
}

/**
 * Infer price range from liked places. Returns allowed price levels or null to skip filtering.
 */
export function inferPriceRange(likedPlaces: Place[]): PriceLevel[] | null {
  const withPrice = likedPlaces.filter((p) => p.priceLevel != null);
  if (withPrice.length < 2) return null;

  const levels: PriceLevel[] = [
    'FREE',
    'INEXPENSIVE',
    'MODERATE',
    'EXPENSIVE',
    'VERY_EXPENSIVE',
  ];
  const priceIndex = (level: PriceLevel): number => levels.indexOf(level);
  const minLevel = Math.min(
    ...withPrice.map((p) => priceIndex(p.priceLevel!)).filter((i) => i >= 0)
  );
  const maxLevel = Math.max(
    ...withPrice.map((p) => priceIndex(p.priceLevel!)).filter((i) => i >= 0)
  );
  return levels.slice(minLevel, maxLevel + 1);
}

function cosineSparseVectors(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dot = 0;
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (vb != null) dot += va * vb;
  }
  let na = 0;
  let nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * TF-IDF user profile over place types from liked places.
 */
export function buildUserTypeTfIdfProfile(
  likedPlaces: Place[]
): Map<string, number> {
  if (likedPlaces.length === 0) return new Map();

  const typesPerPlace = likedPlaces.map((p) => getPlaceTypeTerms(p));
  const N = likedPlaces.length;
  const df = new Map<string, number>();
  for (const terms of typesPerPlace) {
    const unique = new Set(terms);
    for (const t of unique) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  const tf = new Map<string, number>();
  for (const terms of typesPerPlace) {
    for (const t of terms) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }
  }
  const maxTf = Math.max(...tf.values(), 1);

  const vector = new Map<string, number>();
  for (const [t, f] of tf) {
    const tfNorm = 0.5 + (0.5 * f) / maxTf;
    const idf = Math.log((N + 1) / ((df.get(t) ?? 0) + 1)) + 1;
    vector.set(t, tfNorm * idf);
  }
  return vector;
}

/**
 * Candidate document vector: binary presence × IDF (same IDF stats as profile corpus).
 */
function buildCandidateTypeVector(
  place: Place,
  idfByTerm: Map<string, number>
): Map<string, number> {
  const terms = getPlaceTypeTerms(place);
  const vec = new Map<string, number>();
  for (const t of terms) {
    const idf = idfByTerm.get(t) ?? 1;
    vec.set(t, idf);
  }
  return vec;
}

function buildIdfMapFromLikes(likedPlaces: Place[]): Map<string, number> {
  const N = likedPlaces.length || 1;
  const typesPerPlace = likedPlaces.map((p) => getPlaceTypeTerms(p));
  const df = new Map<string, number>();
  for (const terms of typesPerPlace) {
    const unique = new Set(terms);
    for (const t of unique) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  const idfByTerm = new Map<string, number>();
  for (const [t, d] of df) {
    idfByTerm.set(t, Math.log((N + 1) / (d + 1)) + 1);
  }
  return idfByTerm;
}

/**
 * Cosine similarity between user type profile and a candidate place (content-based score).
 */
export function contentRelevanceScore(
  userProfile: Map<string, number>,
  idfByTerm: Map<string, number>,
  candidate: Place
): number {
  if (userProfile.size === 0) return 0;
  const docVec = buildCandidateTypeVector(candidate, idfByTerm);
  if (docVec.size === 0) return 0;
  return cosineSparseVectors(userProfile, docVec);
}

/**
 * Re-rank places by TF-IDF cosine vs liked places. Returns scores per id for downstream composite.
 */
export function rankPlacesByContentRelevance(
  likedPlaces: Place[],
  candidates: Place[]
): { ranked: Place[]; contentScoreById: Map<string, number> } {
  const profile = buildUserTypeTfIdfProfile(likedPlaces);
  const idfByTerm = buildIdfMapFromLikes(likedPlaces);
  const contentScoreById = new Map<string, number>();

  const scored = candidates.map((p) => {
    const s = contentRelevanceScore(profile, idfByTerm, p);
    contentScoreById.set(p.id, s);
    return { place: p, score: s };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    ranked: scored.map((x) => x.place),
    contentScoreById,
  };
}

export type CollaborativeScore = { placeId: string; score: number };

export type ScoreCollaborativeParams = {
  usersWhoLiked: UserPlaceLikesDoc[];
  /** Seeds used for the Firestore query (e.g. first N liked place ids). */
  seedPlaceIds: string[];
  currentUserLikedIds: Set<string>;
  ratedPlaceIds: Set<string>;
  excludeUserIds: Set<string>;
  topN?: number;
};

export type CollaborativeScoreForPlaceParams = ScoreCollaborativeParams & {
  candidatePlaceId: string;
};

export function buildPlaceToUsersMap(
  usersWhoLiked: UserPlaceLikesDoc[],
  excludeUserIds: Set<string>
): Map<string, Set<string>> {
  const pool = usersWhoLiked.filter((d) => !excludeUserIds.has(d.id));
  const placeToUsers = new Map<string, Set<string>>();
  for (const doc of pool) {
    for (const pid of doc.placeIds) {
      let set = placeToUsers.get(pid);
      if (!set) {
        set = new Set();
        placeToUsers.set(pid, set);
      }
      set.add(doc.id);
    }
  }
  return placeToUsers;
}

function computeMaxCollaborativeSimForCandidate(
  candidatePlaceId: string,
  seeds: string[],
  placeToUsers: Map<string, Set<string>>
): number {
  const c = candidatePlaceId;
  const Uc = placeToUsers.get(c);
  if (!Uc || Uc.size === 0) return 0;

  let maxSim = 0;
  for (const s of seeds) {
    if (s === c) continue;
    const Us = placeToUsers.get(s);
    if (!Us || Us.size === 0) continue;

    let inter = 0;
    for (const u of Us) {
      if (Uc.has(u)) inter += 1;
    }
    if (inter === 0) continue;

    const sim = inter / Math.sqrt(Us.size * Uc.size);
    if (sim > maxSim) maxSim = sim;
  }
  return maxSim;
}

/**
 * Max item–item similarity between `candidatePlaceId` and any seed (same math as batch CF).
 * Does not exclude `candidatePlaceId` for being in `currentUserLikedIds`, so place detail can
 * show a community score for places the user already liked.
 */
export function collaborativeScoreForPlaceId(
  params: CollaborativeScoreForPlaceParams
): number | undefined {
  const {
    usersWhoLiked,
    seedPlaceIds,
    ratedPlaceIds,
    excludeUserIds,
    candidatePlaceId,
  } = params;

  if (ratedPlaceIds.has(candidatePlaceId)) return undefined;

  const placeToUsers = buildPlaceToUsersMap(usersWhoLiked, excludeUserIds);
  const seeds = seedPlaceIds.filter((s) => placeToUsers.has(s));
  if (seeds.length === 0) return undefined;

  const maxSim = computeMaxCollaborativeSimForCandidate(
    candidatePlaceId,
    seeds,
    placeToUsers
  );
  return maxSim > 0 ? maxSim : undefined;
}

/**
 * Item–item collaborative filtering: cosine similarity between implicit user sets
 * in the fetched pool. sim(s,c) = |U_s ∩ U_c| / sqrt(|U_s|·|U_c|), aggregated by max over seeds.
 */
export function scoreCollaborativeCandidates(
  params: ScoreCollaborativeParams
): CollaborativeScore[] {
  const {
    usersWhoLiked,
    seedPlaceIds,
    currentUserLikedIds,
    ratedPlaceIds,
    excludeUserIds,
    topN = 20,
  } = params;

  const pool = usersWhoLiked.filter((d) => !excludeUserIds.has(d.id));
  const placeToUsers = buildPlaceToUsersMap(usersWhoLiked, excludeUserIds);

  const seeds = seedPlaceIds.filter((s) => placeToUsers.has(s));
  if (seeds.length === 0) return [];

  const candidates = new Set<string>();
  for (const doc of pool) {
    for (const pid of doc.placeIds) {
      if (currentUserLikedIds.has(pid)) continue;
      if (ratedPlaceIds.has(pid)) continue;
      candidates.add(pid);
    }
  }

  const scores = new Map<string, number>();

  for (const c of candidates) {
    const maxSim = computeMaxCollaborativeSimForCandidate(
      c,
      seeds,
      placeToUsers
    );
    if (maxSim > 0) scores.set(c, maxSim);
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([placeId, score]) => ({ placeId, score }));
}

/**
 * Reciprocal Rank Fusion: merge ranked lists without score calibration.
 */
export function mergeWithRrf(
  rankedLists: Place[][],
  k: number,
  maxResults: number
): Place[] {
  const rrfScore = new Map<string, number>();
  const placeById = new Map<string, Place>();

  for (const items of rankedLists) {
    items.forEach((place, rank) => {
      placeById.set(place.id, place);
      const add = 1 / (k + rank + 1);
      rrfScore.set(place.id, (rrfScore.get(place.id) ?? 0) + add);
    });
  }

  return [...rrfScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults)
    .map(([id]) => placeById.get(id)!);
}

/**
 * Bayesian average for aggregate rating + review count (reduces high variance from few reviews).
 */
export function bayesianAverageRating(
  rating: number | undefined,
  reviewCount: number | undefined
): number {
  const r = rating ?? BAYESIAN_PRIOR_RATING;
  const n = reviewCount ?? 0;
  return (
    (BAYESIAN_PRIOR_WEIGHT * BAYESIAN_PRIOR_RATING + r * n) /
    (BAYESIAN_PRIOR_WEIGHT + n)
  );
}

function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export type DietaryPeerScoreParams = {
  placeToUsers: Map<string, Set<string>>;
  viewerUserId: string;
  viewerDietaryIds: string[];
  dietaryByUserId: Map<string, string[]>;
};

/**
 * Mean Jaccard between the viewer and likers who have public dietary IDs.
 * Omits place ids when no liker has usable dietary data.
 */
export function computeDietaryPeerScoresByPlaceId(
  params: DietaryPeerScoreParams
): Map<string, number> {
  const viewerSet = new Set(
    normalizeDietaryPreferenceIds(params.viewerDietaryIds)
  );
  if (viewerSet.size === 0) return new Map();

  const out = new Map<string, number>();
  for (const [placeId, userIds] of params.placeToUsers) {
    const likers = [...userIds].filter((u) => u !== params.viewerUserId);
    if (likers.length === 0) continue;

    const scores: number[] = [];
    for (const u of likers) {
      const peerDiet = params.dietaryByUserId.get(u);
      if (!peerDiet || peerDiet.length === 0) continue;
      const peerSet = new Set(normalizeDietaryPreferenceIds(peerDiet));
      scores.push(jaccardSimilarity(viewerSet, peerSet));
    }
    if (scores.length === 0) continue;
    const mean = scores.reduce((acc, x) => acc + x, 0) / scores.length;
    out.set(placeId, clamp01(mean));
  }
  return out;
}

/** Map [0,5] star scale to [0,1] for blending */
function ratingToUnit(bayes: number): number {
  return clamp01(bayes / 5);
}

function distanceScoreForPlace(
  place: Place,
  userLocation: { latitude: number; longitude: number } | null
): number {
  if (!userLocation || !place.location) return 0.5;
  const km = haversineDistance(
    userLocation.latitude,
    userLocation.longitude,
    place.location.latitude,
    place.location.longitude
  );
  return clamp01(Math.exp(-km / DISTANCE_DECAY_KM));
}

function personalizationScore(
  collab: number | undefined,
  content: number | undefined
): number {
  const hasC = collab != null && collab > 0;
  const hasT = content != null && content > 0;
  if (hasC && hasT) return clamp01(((collab ?? 0) + (content ?? 0)) / 2);
  if (hasC) return clamp01(collab ?? 0);
  if (hasT) return clamp01(content ?? 0);
  return 0;
}

export type CompositeRankingContext = {
  userLocation: { latitude: number; longitude: number } | null;
  contentScoreById: Map<string, number>;
  collabScoreById: Map<string, number>;
  /** When true, viewer has dietary prefs — 4-factor or reweighted 3-factor per place. */
  viewerDietaryActive?: boolean;
  /** Per-place peer dietary affinity; missing key means exclude dietary term for that place. */
  dietaryScoreById?: Map<string, number>;
  /** Normalized dietary IDs of the viewer, used for type-based dietary scoring. */
  viewerDietaryIds?: string[];
  /** Viewer’s own rating per place id; applied via `getSelfRatingMultiplier` to composite. */
  selfRatingById?: Map<string, PlaceRating>;
};

export type CompositeWeightsBreakdown = {
  quality: number;
  distance: number;
  personalization: number;
  dietary?: number;
};

export type PlaceMatchBreakdown = {
  /** Normalized quality [0, 1] from Bayesian rating. */
  quality: number;
  /** Distance decay [0, 1]. */
  distance: number;
  /** Raw TF–IDF cosine vs liked places, if defined for this place. */
  content: number | undefined;
  /** Raw collaborative similarity, if defined for this place. */
  collaborative: number | undefined;
  /** Blend used in composite (same as `personalizationScore`). */
  personalization: number;
  /** Peer dietary affinity when in composite; null when excluded (show N/A). */
  dietary: number | null;
  weightedQuality: number;
  weightedDistance: number;
  weightedPersonal: number;
  weightedDietary: number | null;
  composite: number;
  weights: CompositeWeightsBreakdown;
  dietaryIncludedInComposite: boolean;
  /** The viewer's own rating for this place, if any. */
  selfRating?: PlaceRating;
  /** Multiplier applied to composite based on selfRating (1 when unrated). */
  selfRatingMultiplier: number;
};

type CompositeWeightsResolved = {
  wq: number;
  wd: number;
  wp: number;
  wdi?: number;
  dietaryRaw: number | null;
  dietaryInComposite: boolean;
};

function getCompositeWeightsForPlace(
  place: Place,
  ctx: CompositeRankingContext
): CompositeWeightsResolved {
  const viewerActive = ctx.viewerDietaryActive === true;

  if (!viewerActive) {
    return {
      wq: W_LEGACY_QUALITY,
      wd: W_LEGACY_DISTANCE,
      wp: W_LEGACY_PERSONAL,
      dietaryRaw: null,
      dietaryInComposite: false,
    };
  }

  const peerVal = ctx.dietaryScoreById?.get(place.id);
  const typeVal =
    ctx.viewerDietaryIds && ctx.viewerDietaryIds.length > 0
      ? placeTypeDietaryScore(place, ctx.viewerDietaryIds)
      : 0;

  const hasPeer = peerVal !== undefined;
  const hasType = typeVal > 0;

  if (hasPeer || hasType) {
    const combined = Math.max(peerVal ?? 0, typeVal);
    return {
      wq: W4_QUALITY,
      wd: W4_DISTANCE,
      wp: W4_PERSONAL,
      wdi: W4_DIETARY,
      dietaryRaw: combined,
      dietaryInComposite: true,
    };
  }

  return {
    wq: W3_FROM4_QUALITY,
    wd: W3_FROM4_DISTANCE,
    wp: W3_FROM4_PERSONAL,
    dietaryRaw: null,
    dietaryInComposite: false,
  };
}

/**
 * Scalar used to rank places in Explore; same formula as `getPlaceMatchBreakdown`.composite.
 */
export function computePlaceCompositeScore(
  place: Place,
  ctx: CompositeRankingContext
): number {
  return placeCompositeScore(place, ctx);
}

/**
 * Per-factor scores and weighted contributions for match UI (place detail).
 */
export function getPlaceMatchBreakdown(
  place: Place,
  ctx: CompositeRankingContext
): PlaceMatchBreakdown {
  const q = ratingToUnit(
    bayesianAverageRating(place.rating, place.userRatingCount)
  );
  const d = distanceScoreForPlace(place, ctx.userLocation);
  const collabRaw = ctx.collabScoreById.get(place.id);
  const contentRaw = ctx.contentScoreById.get(place.id);
  const p = personalizationScore(collabRaw, contentRaw);
  const w = getCompositeWeightsForPlace(place, ctx);

  let composite: number;
  let weightedDietary: number | null = null;
  let dietary: number | null = null;

  if (w.dietaryInComposite && w.wdi !== undefined && w.dietaryRaw !== null) {
    dietary = w.dietaryRaw;
    weightedDietary = w.wdi * w.dietaryRaw;
    composite = w.wq * q + w.wd * d + w.wp * p + weightedDietary;
  } else {
    composite = w.wq * q + w.wd * d + w.wp * p;
  }

  const selfRating = ctx.selfRatingById?.get(place.id);
  const selfRatingMultiplier = getSelfRatingMultiplier(selfRating);
  composite = Math.min(1, Math.max(0, composite * selfRatingMultiplier));

  const weights: CompositeWeightsBreakdown =
    w.dietaryInComposite && w.wdi !== undefined
      ? {
          quality: w.wq,
          distance: w.wd,
          personalization: w.wp,
          dietary: w.wdi,
        }
      : {
          quality: w.wq,
          distance: w.wd,
          personalization: w.wp,
        };

  return {
    quality: q,
    distance: d,
    content: contentRaw,
    collaborative: collabRaw,
    personalization: p,
    dietary,
    weightedQuality: w.wq * q,
    weightedDistance: w.wd * d,
    weightedPersonal: w.wp * p,
    weightedDietary,
    composite,
    weights,
    dietaryIncludedInComposite: w.dietaryInComposite,
    selfRating,
    selfRatingMultiplier,
  };
}

export type RankedPlacesResult = {
  ranked: Place[];
  scoreById: Map<string, number>;
};

/**
 * Final ordering: weighted composite of quality (Bayesian), distance decay, and personalization.
 */
export function rankPlacesByCompositeScore(
  places: Place[],
  ctx: CompositeRankingContext
): RankedPlacesResult {
  const scoreById = new Map<string, number>();
  for (const p of places) {
    scoreById.set(p.id, placeCompositeScore(p, ctx));
  }
  const ranked = [...places].sort(
    (a, b) => (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0)
  );
  return { ranked, scoreById };
}

function placeCompositeScore(
  place: Place,
  ctx: CompositeRankingContext
): number {
  const q = ratingToUnit(
    bayesianAverageRating(place.rating, place.userRatingCount)
  );
  const d = distanceScoreForPlace(place, ctx.userLocation);
  const collab = ctx.collabScoreById.get(place.id);
  const content = ctx.contentScoreById.get(place.id);
  const p = personalizationScore(collab, content);
  const w = getCompositeWeightsForPlace(place, ctx);
  let base: number;
  if (w.dietaryInComposite && w.wdi !== undefined && w.dietaryRaw !== null) {
    base = w.wq * q + w.wd * d + w.wp * p + w.wdi * w.dietaryRaw;
  } else {
    base = w.wq * q + w.wd * d + w.wp * p;
  }
  const mult = getSelfRatingMultiplier(ctx.selfRatingById?.get(place.id));
  return Math.min(1, Math.max(0, base * mult));
}

/** Legacy helper: sort by raw star rating only */
export function sortPlacesByRating(places: Place[]): Place[] {
  return [...places].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}
