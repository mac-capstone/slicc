/**
 * V&V §6.5 — ML Kit / Expo Voice → structured expense slots.
 * §6.5.1 — behaviour + error-style inputs; §6.5.2 — latency (<3s) on this harness.
 * TA feedback: pair latency with slot correctness (WER, price error), not time alone.
 */

function getItemAndAmountFromTaggedWords(taggedWords: any[]): {
  itemName: string;
  itemAmount: number;
} {
  let itemName = '';
  let itemAmount = 0;
  let index = 0;
  let start = -1;
  let end = -1;
  let lastCDIndex = -1;

  taggedWords.forEach((pair: [string, string]) => {
    if (pair[1] === '$') {
      if (index + 1 < taggedWords.length) {
        itemAmount = parseFloat(taggedWords[index + 1][0]);
      }
      if (start !== -1 && end === -1) {
        end = index;
      }
    } else if (
      pair[0].toLowerCase() !== 'cost' &&
      pair[0].toLowerCase() !== 'dollar' &&
      pair[0].toLowerCase() !== 'dollars' &&
      (pair[1] === 'NN' ||
        pair[1] === 'NNS' ||
        pair[1] === 'NNP' ||
        pair[1] === 'NNPS')
    ) {
      if (start === -1) {
        start = index;
      }
    } else {
      if (pair[0].toLowerCase() !== 'and') {
        if (start !== -1 && end === -1) {
          end = index;
        }
      } else {
        if (
          index + 1 !== taggedWords.length &&
          (taggedWords[index + 1][1] === 'NN' ||
            taggedWords[index + 1][1] === 'NNS' ||
            taggedWords[index + 1][1] === 'NNP' ||
            taggedWords[index + 1][1] === 'NNPS')
        ) {
          // continue item name
        } else {
          if (start !== -1 && end === -1) {
            end = index;
          }
        }
      }
    }
    if (pair[1] === 'CD') {
      lastCDIndex = index;
    }

    index++;
  });
  if (lastCDIndex !== -1 && itemAmount === 0) {
    itemAmount = parseFloat(taggedWords[lastCDIndex][0]);
  }

  if (end === -1) {
    end = taggedWords.length;
  }
  if (start === -1) {
    itemName = '';
  } else {
    itemName = taggedWords
      .slice(start, end)
      .map((pair: [string, string]) => pair[0])
      .join(' ');
  }

  return { itemName, itemAmount };
}

function extractFromTranscript(transcript: string) {
  const pos = require('pos');
  const words = new pos.Lexer().lex(transcript);
  const tagger = new pos.Tagger();
  const taggedWords = tagger.tag(words);
  return getItemAndAmountFromTaggedWords(taggedWords);
}

/** Word-level error rate between reference and hypothesis (0 = perfect). */
function wordErrorRate(reference: string, hypothesis: string): number {
  const ref = reference.toLowerCase().split(/\s+/).filter(Boolean);
  const hyp = hypothesis.toLowerCase().split(/\s+/).filter(Boolean);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
  const m = ref.length;
  const n = hyp.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n] / ref.length;
}

function relativePriceError(expected: number, actual: number): number {
  if (expected === 0) return actual === 0 ? 0 : 1;
  return Math.abs(expected - actual) / Math.abs(expected);
}

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
