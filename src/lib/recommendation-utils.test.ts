import type { Place } from '@/api/places/places-api';

import {
  bayesianAverageRating,
  collaborativeScoreForPlaceId,
  computeDietaryPeerScoresByPlaceId,
  computePlaceCompositeScore,
  getPlaceMatchBreakdown,
  mergeWithRrf,
  rankPlacesByContentRelevance,
  RRF_K,
  scoreCollaborativeCandidates,
} from './recommendation-utils';

function place(
  id: string,
  types: { primaryType?: string; types?: string[] }
): Place {
  return {
    id,
    displayName: id,
    ...types,
  };
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
    expect(
      bd.weightedQuality +
        bd.weightedDistance +
        bd.weightedPersonal +
        (bd.weightedDietary ?? 0)
    ).toBeCloseTo(bd.composite, 5);
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
