import type { UserPlaceLikesDoc } from '@/api/places/place-likes-api';
import type { Place, PriceLevel } from '@/api/places/places-api';
import { haversineDistance } from '@/lib/geo';

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

/** RRF constant k (rank fusion); common default ~60 */
export const RRF_K = 60;

/** Composite ranking weights (quality, distance decay, personalization) */
const W_QUALITY = 0.35;
const W_DISTANCE = 0.3;
const W_PERSONAL = 0.35;

/** Bayesian prior for star ratings when review count is low */
const BAYESIAN_PRIOR_RATING = 3.5;
const BAYESIAN_PRIOR_WEIGHT = 8;

/** Distance decay scale (km); smaller = stronger preference for nearby */
const DISTANCE_DECAY_KM = 15;

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
    if (type) {
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

  const levels: PriceLevel[] = ['FREE', 'INEXPENSIVE', 'MODERATE', 'EXPENSIVE'];
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
    const Uc = placeToUsers.get(c);
    if (!Uc || Uc.size === 0) continue;

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

/** Map [0,5] star scale to [0,1] for blending */
function ratingToUnit(bayes: number): number {
  return clamp01(bayes / 5);
}

function distanceScoreForPlace(
  place: Place,
  userLocation: { latitude: number; longitude: number }
): number {
  if (!place.location) return 0.5;
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
  userLocation: { latitude: number; longitude: number };
  contentScoreById: Map<string, number>;
  collabScoreById: Map<string, number>;
};

/**
 * Final ordering: weighted composite of quality (Bayesian), distance decay, and personalization.
 */
export function rankPlacesByCompositeScore(
  places: Place[],
  ctx: CompositeRankingContext
): Place[] {
  return [...places].sort((a, b) => {
    const scoreA = placeCompositeScore(a, ctx);
    const scoreB = placeCompositeScore(b, ctx);
    return scoreB - scoreA;
  });
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
  return W_QUALITY * q + W_DISTANCE * d + W_PERSONAL * p;
}

/** Legacy helper: sort by raw star rating only */
export function sortPlacesByRating(places: Place[]): Place[] {
  return [...places].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}
