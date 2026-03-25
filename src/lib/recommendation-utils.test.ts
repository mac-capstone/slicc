import type { Place } from '@/api/places/places-api';

import {
  bayesianAverageRating,
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
