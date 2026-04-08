import { calculatePersonShare } from '@/lib/utils';
import { type ItemWithId } from '@/types';

/**
 * V&V §6.2.2 — business-layer performance budget (expense math).
 * Uses many iterations to measure aggregate CPU time; threshold is generous to avoid flaky CI.
 */
describe('V&V business-layer performance (§6.2.2)', () => {
  const item: ItemWithId = {
    id: 'i1' as ItemWithId['id'],
    name: 'Shared item',
    amount: 99.99,
    taxRate: 0,
    split: {
      mode: 'custom',
      shares: Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => [`u${i}`, i + 1])
      ),
    },
    assignedPersonIds: [],
  };

  it('keeps per-share calculation well under the 200ms responsiveness budget', () => {
    const iterations = 5000;
    const t0 = global.performance.now();
    for (let i = 0; i < iterations; i++) {
      calculatePersonShare(item, 'u5');
    }
    const elapsed = global.performance.now() - t0;
    const perOpMs = elapsed / iterations;
    expect(perOpMs).toBeLessThan(200);
  });
});
