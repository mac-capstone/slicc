/**
 * V&V §6.5 — ML Kit / Expo Voice → structured expense slots.
 * §6.5.1 — behaviour + error-style inputs; §6.5.2 — latency (<3s) on this harness.
 * TA feedback: pair latency with slot correctness (WER, price error), not time alone.
 * Implementation: `vv-snapshot-metrics.ts` (metrics export on `pnpm run test:ci`).
 */
import {
  extractFromTranscript,
  getItemAndAmountFromTaggedWords,
  relativePriceError,
  wordErrorRate,
} from '@/vv/vv-snapshot-metrics';

describe('Voice → item slots (§6.5) with correctness metrics', () => {
  const cases: {
    transcript: string;
    goldName: string;
    goldAmount: number;
    maxWer: number;
    maxPriceRelErr: number;
  }[] = [
    {
      transcript: 'burger $9.99',
      goldName: 'burger',
      goldAmount: 9.99,
      maxWer: 0.35,
      maxPriceRelErr: 0.01,
    },
    {
      transcript: 'large fries cost $3.50',
      goldName: 'large fries',
      goldAmount: 3.5,
      maxWer: 0.5,
      maxPriceRelErr: 0.01,
    },
  ];

  it.each(cases)(
    'extracts name/amount within WER and price tolerances for %j',
    ({ transcript, goldName, goldAmount, maxWer, maxPriceRelErr }) => {
      const t0 = global.performance.now();
      const { itemName, itemAmount } = extractFromTranscript(transcript);
      const elapsed = global.performance.now() - t0;
      expect(elapsed).toBeLessThan(3000);

      const wer = wordErrorRate(goldName, itemName);
      expect(wer).toBeLessThanOrEqual(maxWer);

      const priceErr = relativePriceError(goldAmount, itemAmount);
      expect(priceErr).toBeLessThanOrEqual(maxPriceRelErr);
    }
  );

  it('reports high WER when the transcript does not match the gold item phrase', () => {
    const { itemName } = extractFromTranscript('water');
    expect(wordErrorRate('chicken sandwich', itemName)).toBeGreaterThan(0.4);
  });

  describe('§6.5.1 unclear or partial recognition (TA feedback)', () => {
    it('yields empty slots when the transcript has no extractable noun/price', () => {
      const { itemName, itemAmount } = extractFromTranscript('. . .');
      expect(itemName).toBe('');
      expect(itemAmount).toBe(0);
    });

    it('still completes under the §6.5.2 latency budget for noisy input', () => {
      const t0 = global.performance.now();
      extractFromTranscript('um well I think maybe sort of');
      expect(global.performance.now() - t0).toBeLessThan(3000);
    });
  });

  describe('getItemAndAmountFromTaggedWords edge cases', () => {
    it('does not throw when $ is the last token (no following price word)', () => {
      const tagged: [string, string][] = [['$', '$']];
      expect(() => getItemAndAmountFromTaggedWords(tagged)).not.toThrow();
      const { itemName, itemAmount } = getItemAndAmountFromTaggedWords(tagged);
      expect(itemName).toBe('');
      expect(itemAmount).toBe(0);
    });

    it('uses an empty item name when no noun span was found', () => {
      const tagged: [string, string][] = [
        ['maybe', 'RB'],
        ['12', 'CD'],
      ];
      const { itemName } = getItemAndAmountFromTaggedWords(tagged);
      expect(itemName).toBe('');
    });
  });
});
