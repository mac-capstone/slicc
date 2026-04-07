import {
  DIETARY_PREFERENCE_IDS,
  normalizeDietaryPreferenceIds,
  VALID_DIETARY_IDS,
} from '@/lib/dietary-preference-options';

describe('dietary-preference-options', () => {
  it('keeps a stable allow-list', () => {
    expect(DIETARY_PREFERENCE_IDS).toContain('vegan');
    expect(VALID_DIETARY_IDS.size).toBe(DIETARY_PREFERENCE_IDS.length);
  });

  it('normalizeDietaryPreferenceIds dedupes and preserves first-seen order', () => {
    expect(
      normalizeDietaryPreferenceIds(['vegan', 'vegan', 'halal', 'vegan'])
    ).toEqual(['vegan', 'halal']);
  });

  it('drops unknown ids', () => {
    expect(normalizeDietaryPreferenceIds(['vegan', 'not_a_real_diet'])).toEqual(
      ['vegan']
    );
  });
});
