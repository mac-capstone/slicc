import { meanOfNumbers } from '@/lib/mean-group-score';

describe('meanOfNumbers', () => {
  it('returns null for empty input', () => {
    expect(meanOfNumbers([])).toBeNull();
  });

  it('returns the arithmetic mean', () => {
    expect(meanOfNumbers([0.2, 0.4, 0.6])).toBeCloseTo(0.4, 6);
    expect(meanOfNumbers([1])).toBe(1);
  });
});
