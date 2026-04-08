import {
  isTipPercentOption,
  normalizeStoredTipPercent,
  TIP_PERCENT_OPTIONS,
} from '@/lib/tip-percent-options';

describe('tip-percent-options', () => {
  it('exposes a fixed ordered set of tip percents', () => {
    expect(TIP_PERCENT_OPTIONS).toEqual([0, 10, 15, 20, 25]);
  });

  it('isTipPercentOption narrows allowed values', () => {
    expect(isTipPercentOption(15)).toBe(true);
    expect(isTipPercentOption(18)).toBe(false);
  });

  describe('normalizeStoredTipPercent', () => {
    it('returns 0 for undefined or NaN', () => {
      expect(normalizeStoredTipPercent(undefined)).toBe(0);
      expect(normalizeStoredTipPercent(Number.NaN)).toBe(0);
    });

    it('returns exact option when already valid', () => {
      expect(normalizeStoredTipPercent(20)).toBe(20);
    });

    it('maps legacy values to the nearest option', () => {
      expect(normalizeStoredTipPercent(18)).toBe(20);
      expect(normalizeStoredTipPercent(12)).toBe(10);
    });

    it('clamps non-positive values to 0', () => {
      expect(normalizeStoredTipPercent(-5)).toBe(0);
      expect(normalizeStoredTipPercent(0)).toBe(0);
    });
  });
});
