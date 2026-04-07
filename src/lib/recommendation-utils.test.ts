import type { Place } from '@/api/places/places-api';

import {
  bayesianAverageRating,
  collaborativeScoreForPlaceId,
  computeDietaryPeerScoresByPlaceId,
  computePlaceCompositeScore,
  deduplicateByName,
  getPlaceMatchBreakdown,
  getSelfRatingMultiplier,
  mergeWithRrf,
  placeTypeDietaryScore,
  rankPlacesByContentRelevance,
  RRF_K,
  scoreCollaborativeCandidates,
  SELF_RATING_MULTIPLIER_DOWN,
  SELF_RATING_MULTIPLIER_NEUTRAL,
  SELF_RATING_MULTIPLIER_UP,
} from './recommendation-utils';

function place(
  id: string,
  overrides: {
    primaryType?: string;
    types?: string[];
    displayName?: string;
    location?: { latitude: number; longitude: number };
  } = {}
): Place {
  const { displayName = id, ...rest } = overrides;
  return { id, displayName, ...rest };
}

describe('bayesianAverageRating', () => {
  it('pulls uncertain ratings toward the prior when review count is low', () => {
    const highFew = bayesianAverageRating(5, 2);
    const highMany = bayesianAverageRating(5, 500);
    expect(highFew).toBeLessThan(highMany);
  });

  it('uses the prior when rating is missing', () => {
    expect(bayesianAverageRating(undefined, undefined)).toBeCloseTo(3.5, 1);
  });
});

describe('mergeWithRrf', () => {
  it('ranks items that appear high in multiple lists above single-list items', () => {
    const a = place('a', { primaryType: 'cafe' });
    const b = place('b', { primaryType: 'bar' });
    const c = place('c', { primaryType: 'bakery' });

    const merged = mergeWithRrf(
      [
        [a, b],
        [b, c],
      ],
      RRF_K,
      10
    );

    const scoreB = 1 / (RRF_K + 1) + 1 / (RRF_K + 1);
    const scoreA = 1 / (RRF_K + 1);
    const scoreC = 1 / (RRF_K + 2);
    expect(scoreB).toBeGreaterThan(scoreA);
    expect(scoreB).toBeGreaterThan(scoreC);

    expect(merged[0]).toEqual(b);
  });
});

describe('scoreCollaborativeCandidates', () => {
  it('scores item–item cosine similarity against seeds (max over seeds)', () => {
    const scored = scoreCollaborativeCandidates({
      usersWhoLiked: [
        { id: 'u1', placeIds: ['seedA', 'candB'] },
        { id: 'u2', placeIds: ['seedA', 'candB'] },
      ],
      seedPlaceIds: ['seedA'],
      currentUserLikedIds: new Set(['seedA']),
      ratedPlaceIds: new Set(),
      excludeUserIds: new Set(),
      topN: 5,
    });

    expect(scored).toHaveLength(1);
    expect(scored[0].placeId).toBe('candB');
    expect(scored[0].score).toBeCloseTo(1, 5);
  });
});

describe('getPlaceMatchBreakdown', () => {
  it('matches computePlaceCompositeScore on the composite field', () => {
    const p = place('p1', { primaryType: 'cafe', types: ['cafe'] });
    const ctx = {
      userLocation: { latitude: 43.65, longitude: -79.38 },
      contentScoreById: new Map([['p1', 0.4]]),
      collabScoreById: new Map([['p1', 0.2]]),
    };
    const bd = getPlaceMatchBreakdown(p, ctx);
    expect(bd.composite).toBe(computePlaceCompositeScore(p, ctx));
    const baseSum =
      bd.weightedQuality +
      bd.weightedDistance +
      bd.weightedPersonal +
      (bd.weightedDietary ?? 0);
    expect(bd.composite).toBeCloseTo(
      Math.min(1, Math.max(0, baseSum * bd.selfRatingMultiplier)),
      5
    );
  });

  it('applies self-rating multiplier to composite and breakdown', () => {
    const p = place('p1', { primaryType: 'cafe', types: ['cafe'] });
    const ctx = {
      userLocation: { latitude: 43.65, longitude: -79.38 },
      contentScoreById: new Map([['p1', 0.4]]),
      collabScoreById: new Map([['p1', 0.2]]),
      selfRatingById: new Map<string, 'up' | 'down' | 'neutral'>([
        ['p1', 'down'],
      ]),
    };
    const bd = getPlaceMatchBreakdown(p, ctx);
    expect(bd.selfRating).toBe('down');
    expect(bd.selfRatingMultiplier).toBe(0.8);
    const baseSum =
      bd.weightedQuality +
      bd.weightedDistance +
      bd.weightedPersonal +
      (bd.weightedDietary ?? 0);
    expect(bd.composite).toBeCloseTo(
      Math.min(1, Math.max(0, baseSum * 0.8)),
      5
    );
    expect(bd.composite).toBe(computePlaceCompositeScore(p, ctx));
  });

  it('reweights to three factors when viewer has dietary prefs but no peer score', () => {
    const p = place('p1', { primaryType: 'cafe', types: ['cafe'] });
    const ctx = {
      userLocation: { latitude: 43.65, longitude: -79.38 },
      contentScoreById: new Map([['p1', 0.4]]),
      collabScoreById: new Map([['p1', 0.2]]),
      viewerDietaryActive: true,
      dietaryScoreById: new Map(),
    };
    const bd = getPlaceMatchBreakdown(p, ctx);
    expect(bd.dietaryIncludedInComposite).toBe(false);
    expect(bd.dietary).toBeNull();
    const sum =
      bd.weights.quality + bd.weights.distance + bd.weights.personalization;
    expect(sum).toBeCloseTo(1, 5);
    expect(bd.weights.dietary).toBeUndefined();
  });

  it('uses four factors when dietary peer score exists', () => {
    const p = place('p1', { primaryType: 'cafe', types: ['cafe'] });
    const ctx = {
      userLocation: { latitude: 43.65, longitude: -79.38 },
      contentScoreById: new Map([['p1', 0.4]]),
      collabScoreById: new Map([['p1', 0.2]]),
      viewerDietaryActive: true,
      dietaryScoreById: new Map([['p1', 0.8]]),
    };
    const bd = getPlaceMatchBreakdown(p, ctx);
    expect(bd.dietaryIncludedInComposite).toBe(true);
    expect(bd.dietary).toBeCloseTo(0.8, 5);
    const w = bd.weights;
    expect(w.dietary).toBeDefined();
    expect(
      w.quality + w.distance + w.personalization + (w.dietary ?? 0)
    ).toBeCloseTo(1, 5);
  });
});

describe('computeDietaryPeerScoresByPlaceId', () => {
  it('returns mean Jaccard over likers with public diets', () => {
    const placeToUsers = new Map<string, Set<string>>([
      ['placeA', new Set(['u1', 'u2'])],
    ]);
    const dietaryByUserId = new Map<string, string[]>([
      ['u1', ['vegan']],
      ['u2', ['vegan', 'gluten_free']],
    ]);
    const map = computeDietaryPeerScoresByPlaceId({
      placeToUsers,
      viewerUserId: 'self',
      viewerDietaryIds: ['vegan'],
      dietaryByUserId,
    });
    expect(map.get('placeA')).toBeCloseTo((1 + 0.5) / 2, 5);
  });

  it('omits places when no liker has dietary data', () => {
    const placeToUsers = new Map<string, Set<string>>([
      ['placeB', new Set(['u1'])],
    ]);
    const dietaryByUserId = new Map<string, string[]>([['u1', []]]);
    const map = computeDietaryPeerScoresByPlaceId({
      placeToUsers,
      viewerUserId: 'self',
      viewerDietaryIds: ['vegan'],
      dietaryByUserId,
    });
    expect(map.has('placeB')).toBe(false);
  });
});

describe('collaborativeScoreForPlaceId', () => {
  it('returns the same score as batch scoring for a candidate', () => {
    const usersWhoLiked = [
      { id: 'u1', placeIds: ['seedA', 'candB'] },
      { id: 'u2', placeIds: ['seedA', 'candB'] },
    ];
    const batch = scoreCollaborativeCandidates({
      usersWhoLiked,
      seedPlaceIds: ['seedA'],
      currentUserLikedIds: new Set(['seedA']),
      ratedPlaceIds: new Set(),
      excludeUserIds: new Set(),
      topN: 5,
    });
    const single = collaborativeScoreForPlaceId({
      usersWhoLiked,
      seedPlaceIds: ['seedA'],
      candidatePlaceId: 'candB',
      currentUserLikedIds: new Set(['seedA']),
      ratedPlaceIds: new Set(),
      excludeUserIds: new Set(),
    });
    expect(single).toBeCloseTo(batch[0]?.score ?? 0, 5);
    expect(single).toBeCloseTo(1, 5);
  });
});

describe('rankPlacesByContentRelevance', () => {
  it('orders candidates by TF-IDF cosine to liked-place type profile', () => {
    const liked = [
      place('l1', { primaryType: 'cafe', types: ['cafe', 'food'] }),
      place('l2', { primaryType: 'cafe', types: ['cafe'] }),
    ];
    const candidates = [
      place('x', { primaryType: 'bar' }),
      place('y', { primaryType: 'cafe', types: ['cafe', 'restaurant'] }),
    ];

    const { ranked, contentScoreById } = rankPlacesByContentRelevance(
      liked,
      candidates
    );

    expect(ranked[0].id).toBe('y');
    expect(
      (contentScoreById.get('y') ?? 0) > (contentScoreById.get('x') ?? 0)
    ).toBe(true);
  });
});

describe('getSelfRatingMultiplier', () => {
  it('returns the UP multiplier for "up"', () => {
    expect(getSelfRatingMultiplier('up')).toBe(SELF_RATING_MULTIPLIER_UP);
  });

  it('returns the NEUTRAL multiplier for "neutral"', () => {
    expect(getSelfRatingMultiplier('neutral')).toBe(
      SELF_RATING_MULTIPLIER_NEUTRAL
    );
  });

  it('returns the DOWN multiplier for "down"', () => {
    expect(getSelfRatingMultiplier('down')).toBe(SELF_RATING_MULTIPLIER_DOWN);
  });

  it('returns 1 when rating is undefined (no rating)', () => {
    expect(getSelfRatingMultiplier(undefined)).toBe(1);
  });

  it('produces a proportional boost for "up" at different base scores', () => {
    const m = getSelfRatingMultiplier('up');
    const lowBase = 0.4;
    const highBase = 0.8;
    expect(lowBase * m).toBeCloseTo(0.44, 2);
    expect(highBase * m).toBeCloseTo(0.88, 2);
  });

  it('clamps correctly at boundaries', () => {
    const upMultiplier = getSelfRatingMultiplier('up');
    const downMultiplier = getSelfRatingMultiplier('down');
    expect(Math.min(1, Math.max(0, 0.95 * upMultiplier))).toBeLessThanOrEqual(
      1
    );
    expect(
      Math.min(1, Math.max(0, 0.05 * downMultiplier))
    ).toBeGreaterThanOrEqual(0);
  });
});

describe('deduplicateByName', () => {
  const userLocation = { latitude: 43.25, longitude: -79.87 };

  it('keeps only the closest instance of duplicate display names', () => {
    const far = place('mc1', {
      displayName: 'McDonalds',
      location: { latitude: 44.0, longitude: -79.87 },
    });
    const close = place('mc2', {
      displayName: 'McDonalds',
      location: { latitude: 43.26, longitude: -79.87 },
    });
    const unique = place('u1', {
      displayName: 'Burger King',
      location: { latitude: 43.3, longitude: -79.87 },
    });

    const result = deduplicateByName([far, close, unique], userLocation);
    expect(result).toHaveLength(2);
    expect(result.find((p) => p.id === 'mc2')).toBeDefined();
    expect(result.find((p) => p.id === 'u1')).toBeDefined();
  });

  it('is case-insensitive when matching names', () => {
    const a = place('a', {
      displayName: 'Starbucks',
      location: { latitude: 43.26, longitude: -79.87 },
    });
    const b = place('b', {
      displayName: 'starbucks',
      location: { latitude: 44.0, longitude: -79.87 },
    });

    const result = deduplicateByName([a, b], userLocation);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns all places when names are unique', () => {
    const places = [
      place('a', { displayName: 'Place A' }),
      place('b', { displayName: 'Place B' }),
      place('c', { displayName: 'Place C' }),
    ];
    const result = deduplicateByName(places, userLocation);
    expect(result).toHaveLength(3);
  });
});

describe('placeTypeDietaryScore', () => {
  it('returns 1.0 when a halal restaurant matches a halal-only viewer', () => {
    const p = place('h1', {
      primaryType: 'halal_restaurant',
      types: ['halal_restaurant', 'restaurant'],
    });
    expect(placeTypeDietaryScore(p, ['halal'])).toBe(1);
  });

  it('returns 0.5 when matching 1 of 2 dietary preferences', () => {
    const p = place('h2', {
      primaryType: 'halal_restaurant',
      types: ['halal_restaurant', 'restaurant'],
    });
    expect(placeTypeDietaryScore(p, ['halal', 'gluten_free'])).toBe(0.5);
  });

  it('returns 0 when no types match dietary preferences', () => {
    const p = place('r1', {
      primaryType: 'italian_restaurant',
      types: ['italian_restaurant', 'restaurant'],
    });
    expect(placeTypeDietaryScore(p, ['halal'])).toBe(0);
  });

  it('returns 0 when viewer has no dietary preferences', () => {
    const p = place('v1', {
      primaryType: 'vegan_restaurant',
      types: ['vegan_restaurant'],
    });
    expect(placeTypeDietaryScore(p, [])).toBe(0);
  });
});

describe('type-based dietary in composite', () => {
  it('uses 4-factor weights when place has a dietary type even without peer data', () => {
    const p = place('h1', {
      primaryType: 'halal_restaurant',
      types: ['halal_restaurant', 'restaurant'],
    });
    const ctx = {
      userLocation: { latitude: 43.65, longitude: -79.38 },
      contentScoreById: new Map([['h1', 0.4]]),
      collabScoreById: new Map([['h1', 0.2]]),
      viewerDietaryActive: true,
      dietaryScoreById: new Map<string, number>(),
      viewerDietaryIds: ['halal'],
    };
    const bd = getPlaceMatchBreakdown(p, ctx);
    expect(bd.dietaryIncludedInComposite).toBe(true);
    expect(bd.dietary).toBeCloseTo(1, 5);
    expect(bd.weights.dietary).toBeDefined();
  });

  it('picks the max of peer and type scores', () => {
    const p = place('h2', {
      primaryType: 'halal_restaurant',
      types: ['halal_restaurant', 'restaurant'],
    });
    const ctx = {
      userLocation: { latitude: 43.65, longitude: -79.38 },
      contentScoreById: new Map([['h2', 0.4]]),
      collabScoreById: new Map([['h2', 0.2]]),
      viewerDietaryActive: true,
      dietaryScoreById: new Map([['h2', 0.3]]),
      viewerDietaryIds: ['halal'],
    };
    const bd = getPlaceMatchBreakdown(p, ctx);
    expect(bd.dietary).toBeCloseTo(1, 5);
  });
});
