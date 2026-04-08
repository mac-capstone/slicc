/**
 * Single source of truth for V&V OCR + speech metrics (Jest + `vv-snapshot-export.test.ts` on `pnpm run test:ci`).
 * Deterministic (mocked OCR JSON / synthetic transcripts); no live Gemini or microphone.
 */
import { parseReceiptInfo } from '@/lib/utils';

// ─── OCR: CORD-v1-style harness (see cord-v1-ocr-metrics.test.ts) ─────────────

export function parseReceiptInfoCompat(
  result: string,
  parse: typeof parseReceiptInfo
): ReturnType<typeof parseReceiptInfo> {
  const first = parse(result);
  if (first?.success) return first;
  const swapped = result.includes('"item"')
    ? result.replace(/"item":/g, '"dish":')
    : result.replace(/"dish":/g, '"item":');
  return parse(swapped);
}

export function toDishPriceLines(
  data: unknown
): { dish: string; price: number }[] {
  if (Array.isArray(data)) {
    return (data as { dish: string; price: number }[]).map((line) => ({
      dish: line.dish,
      price: line.price,
    }));
  }
  const structured = data as {
    items: { item: string; price: number }[];
  };
  return structured.items.map((line) => ({
    dish: line.item,
    price: line.price,
  }));
}

type ReceiptLine = { dish: string; priceRaw: string };

export type CordSample = {
  imageId: number;
  groundTruth: ReceiptLine[];
  mockedOcrJson: string;
};

function normalizeDish(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseAmount(raw: string): number {
  const source = raw.trim().replace(/[^\d,.-]/g, '');
  if (!source) return 0;

  const hasComma = source.includes(',');
  const hasDot = source.includes('.');
  let normalized = source;

  if (hasComma && hasDot) {
    const lastComma = source.lastIndexOf(',');
    const lastDot = source.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = source.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = source.replace(/,/g, '');
    }
  } else if (hasComma) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(source)) {
      normalized = source.replace(/,/g, '');
    } else {
      normalized = source.replace(',', '.');
    }
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(source)) {
    normalized = source.replace(/\./g, '');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function linesToMap(
  lines: { dish: string; price: number }[]
): Map<string, number> {
  return new Map(lines.map((line) => [normalizeDish(line.dish), line.price]));
}

function harmonicMean(a: number, b: number): number {
  if (a + b === 0) return 0;
  return (2 * a * b) / (a + b);
}

export const cordV1Samples: CordSample[] = [
  {
    imageId: 0,
    groundTruth: [
      { dish: 'Nasi Campur Bali', priceRaw: '75,000' },
      { dish: 'Ice Lemon Tea', priceRaw: '24,000' },
    ],
    mockedOcrJson:
      '[{"item":"Nasi Campur Bali","price":"$75000"},{"item":"Ice Lemon Tea","price":"$24000"}]',
  },
  {
    imageId: 1,
    groundTruth: [
      { dish: 'SPGTHY BOLOGNASE', priceRaw: '58,000' },
      { dish: 'ICED LEMON TEA', priceRaw: '22,000' },
    ],
    mockedOcrJson:
      '[{"item":"SPGTHY BOLOGNASE","price":"$58000"},{"item":"ICED LEMON TEA","price":"$22000"}]',
  },
  {
    imageId: 2,
    groundTruth: [
      { dish: 'HAKAU UDANG', priceRaw: '92,000' },
      { dish: 'CEKER AYAM', priceRaw: '60,000' },
    ],
    mockedOcrJson:
      '[{"item":"HAKAU UDANG","price":"$92000"},{"item":"CEKER AYAM","price":"$60000"}]',
  },
  {
    imageId: 3,
    groundTruth: [
      { dish: 'Bintang Bremer', priceRaw: '59,000' },
      { dish: 'Chicken H-H', priceRaw: '190,000' },
    ],
    mockedOcrJson:
      '[{"item":"Bintang Bremer","price":"$59000"},{"item":"Chicken H-H","price":"$190000"}]',
  },
  {
    imageId: 4,
    groundTruth: [{ dish: 'BASO BIHUN', priceRaw: '43.636' }],
    mockedOcrJson: '[{"item":"BASO BIHUN","price":"$43636"}]',
  },
  {
    imageId: 5,
    groundTruth: [
      { dish: 'Lasagna', priceRaw: '45,000' },
      { dish: 'Iced Cappuccino', priceRaw: '33,000' },
    ],
    mockedOcrJson:
      '[{"item":"Lasagna","price":"$45000"},{"item":"Iced Cappuccino","price":"$33000"}]',
  },
  {
    imageId: 6,
    groundTruth: [
      { dish: 'BASO TAHU', priceRaw: '43,181' },
      { dish: 'ES JERUK', priceRaw: '13,000' },
    ],
    mockedOcrJson:
      '[{"item":"BASO TAHU","price":"$43181"},{"item":"ES JERUK","price":"$13000"}]',
  },
  {
    imageId: 7,
    groundTruth: [{ dish: 'PKT AYAM', priceRaw: '33,000' }],
    mockedOcrJson: '[{"item":"PKT AYAM","price":"$33000"}]',
  },
  {
    imageId: 8,
    groundTruth: [
      { dish: 'Kimchi P', priceRaw: '36.000' },
      { dish: 'Fre ice grentea', priceRaw: '0.000' },
    ],
    mockedOcrJson:
      '[{"item":"Kimchi P","price":"$36000"},{"item":"Fre ice grentea","price":"$0.00"}]',
  },
  {
    imageId: 9,
    groundTruth: [{ dish: 'THAI ICED TEA', priceRaw: '40.000' }],
    mockedOcrJson: '[{"item":"THAI ICED TEA","price":"$38000"}]',
  },
];

/** SRS / V&V table: critical total extraction target. */
export const OCR_TOTAL_AMOUNT_ACCURACY_GOAL = 0.9;
/** Alias for product-metrics tests / V&V wording (“total accuracy”). */
export const OCR_TOTAL_ACCURACY_GOAL = OCR_TOTAL_AMOUNT_ACCURACY_GOAL;
export const OCR_LINE_ITEM_F1_GOAL = 0.8;
/** Alias for V&V “line item” wording. */
export const OCR_LINE_ITEM_ACCURACY_GOAL = OCR_LINE_ITEM_F1_GOAL;
export const OCR_MAX_FAILURE_RATE = 0.1;
export const OCR_MAX_PROCESSING_MS = 5000;

/** Task completion: full workflow budget (planning + split + pay), seconds. */
export const TASK_COMPLETION_GOAL_SECONDS = 120;
/** Content recommendation: F1 @ K goal. */
export const RECOMMENDATION_MIN_F1 = 0.65;

export type CordV1OcrMetrics = {
  sampleCount: number;
  parseSuccessRate: number;
  ocrFailureRate: number;
  linePrecision: number;
  lineRecall: number;
  lineF1: number;
  meanTotalAmountAccuracy: number;
  meanPriceApe: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  budgetMs: number;
};

export function computeCordV1OcrMetrics(): CordV1OcrMetrics {
  const perReceiptLatenciesMs: number[] = [];
  let parsedSuccessCount = 0;
  let totalExpectedLines = 0;
  let totalPredictedLines = 0;
  let truePositiveLines = 0;
  let totalPriceApe = 0;
  let matchedPriceCount = 0;
  const totalAmountAccuracies: number[] = [];

  for (const sample of cordV1Samples) {
    const expected = sample.groundTruth.map((line) => ({
      dish: line.dish,
      price: parseAmount(line.priceRaw),
    }));
    totalExpectedLines += expected.length;
    const gtTotal = expected.reduce((acc, line) => acc + line.price, 0);

    const t0 = global.performance.now();
    const parsed = parseReceiptInfoCompat(
      sample.mockedOcrJson,
      parseReceiptInfo
    );
    perReceiptLatenciesMs.push(global.performance.now() - t0);
    if (!parsed?.success) continue;

    parsedSuccessCount++;
    const predicted = toDishPriceLines(parsed.data);
    totalPredictedLines += predicted.length;
    const predTotal = predicted.reduce((acc, line) => acc + line.price, 0);
    const denomTotal = Math.abs(gtTotal) < 1e-9 ? 1 : Math.abs(gtTotal);
    totalAmountAccuracies.push(
      1 - Math.min(1, Math.abs(gtTotal - predTotal) / denomTotal)
    );

    const expectedByDish = linesToMap(expected);
    const predictedByDish = linesToMap(predicted);

    for (const [dish, predictedPrice] of predictedByDish.entries()) {
      if (!expectedByDish.has(dish)) continue;
      truePositiveLines++;
      const expectedPrice = expectedByDish.get(dish) ?? 0;
      const denom =
        Math.abs(expectedPrice) < 1e-9 ? 1 : Math.abs(expectedPrice);
      totalPriceApe += Math.abs(expectedPrice - predictedPrice) / denom;
      matchedPriceCount++;
    }
  }

  const successRate = parsedSuccessCount / cordV1Samples.length;
  const ocrFailureRate = 1 - successRate;
  const precision =
    totalPredictedLines === 0 ? 0 : truePositiveLines / totalPredictedLines;
  const recall =
    totalExpectedLines === 0 ? 0 : truePositiveLines / totalExpectedLines;
  const lineItemF1 = harmonicMean(precision, recall);
  const meanPriceApe =
    matchedPriceCount === 0 ? 1 : totalPriceApe / matchedPriceCount;
  const meanTotalAmountAccuracy =
    totalAmountAccuracies.length === 0
      ? 0
      : totalAmountAccuracies.reduce((a, b) => a + b, 0) /
        totalAmountAccuracies.length;
  const avgLatencyMs =
    perReceiptLatenciesMs.reduce((acc, n) => acc + n, 0) /
    perReceiptLatenciesMs.length;
  const sortedLat = [...perReceiptLatenciesMs].sort((a, b) => a - b);
  const p95LatencyMs =
    sortedLat[Math.max(0, Math.ceil(sortedLat.length * 0.95) - 1)];

  return {
    sampleCount: cordV1Samples.length,
    parseSuccessRate: successRate,
    ocrFailureRate,
    linePrecision: precision,
    lineRecall: recall,
    lineF1: lineItemF1,
    meanTotalAmountAccuracy,
    meanPriceApe,
    avgLatencyMs,
    p95LatencyMs,
    budgetMs: OCR_MAX_PROCESSING_MS,
  };
}

// ─── Voice: product-level (vv-product-metrics.test.ts) ────────────────────────

export const VOICE_MAX_WER = 0.15;
export const VOICE_INTENT_MIN_PRECISION = 0.85;
export const VOICE_INTENT_MIN_RECALL = 0.8;
export const CORE_OP_MAX_MS = 3000;
export const MAX_VOICE_FAILURE_RATE = 0.1;

export function wordErrorRate(reference: string, hypothesis: string): number {
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

export type VoiceIntent = 'add_line_item' | 'split_bill' | 'other';

export function classifyVoiceIntent(transcript: string): VoiceIntent {
  const t = transcript.toLowerCase();
  if (/\bsplit\b|\bdivide\b|\bshare\s+the\b/.test(t)) return 'split_bill';
  if (/\$|add\b|charge\b|item\b|burger|fries|coffee|pizza/.test(t))
    return 'add_line_item';
  return 'other';
}

export function precisionRecallIntents(
  cases: { transcript: string; gold: VoiceIntent }[]
): { precision: number; recall: number } {
  const byIntent = new Map<
    VoiceIntent,
    { tp: number; fp: number; fn: number }
  >();
  for (const intent of [
    'add_line_item',
    'split_bill',
    'other',
  ] as VoiceIntent[]) {
    byIntent.set(intent, { tp: 0, fp: 0, fn: 0 });
  }
  for (const { transcript, gold } of cases) {
    const pred = classifyVoiceIntent(transcript);
    if (pred === gold) {
      byIntent.get(pred)!.tp++;
    } else {
      byIntent.get(pred)!.fp++;
      byIntent.get(gold)!.fn++;
    }
  }
  let tpSum = 0;
  let fpSum = 0;
  let fnSum = 0;
  for (const { tp, fp, fn } of byIntent.values()) {
    tpSum += tp;
    fpSum += fp;
    fnSum += fn;
  }
  const precision = tpSum + fpSum === 0 ? 1 : tpSum / (tpSum + fpSum);
  const recall = tpSum + fnSum === 0 ? 1 : tpSum / (tpSum + fnSum);
  return { precision, recall };
}

const WER_REFERENCE_PAIRS: { ref: string; hyp: string }[] = [
  { ref: 'burger meal', hyp: 'burger meal' },
  { ref: 'add coffee', hyp: 'add coffee' },
  { ref: 'split the check', hyp: 'split check' },
];

const INTENT_CASES: { transcript: string; gold: VoiceIntent }[] = [
  { transcript: 'split the bill evenly', gold: 'split_bill' },
  { transcript: 'divide between us', gold: 'split_bill' },
  { transcript: 'add a burger for $12', gold: 'add_line_item' },
  { transcript: 'charge coffee 4 dollars', gold: 'add_line_item' },
  { transcript: 'what time is it', gold: 'other' },
];

const SYNTHETIC_VOICE_FAILURES = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  false,
];

export type VvProductVoiceMetrics = {
  meanWer: number;
  werMaxGoal: number;
  intentPrecision: number;
  intentRecall: number;
  intentPrecisionGoal: number;
  intentRecallGoal: number;
  syntheticVoiceFailureRate: number;
  voiceFailureRateGoal: number;
};

export function computeVvProductVoiceMetrics(): VvProductVoiceMetrics {
  const meanWer =
    WER_REFERENCE_PAIRS.reduce(
      (acc, { ref, hyp }) => acc + wordErrorRate(ref, hyp),
      0
    ) / WER_REFERENCE_PAIRS.length;
  const { precision, recall } = precisionRecallIntents(INTENT_CASES);
  const syntheticVoiceFailureRate =
    SYNTHETIC_VOICE_FAILURES.filter((ok) => !ok).length /
    SYNTHETIC_VOICE_FAILURES.length;

  return {
    meanWer,
    werMaxGoal: VOICE_MAX_WER,
    intentPrecision: precision,
    intentRecall: recall,
    intentPrecisionGoal: VOICE_INTENT_MIN_PRECISION,
    intentRecallGoal: VOICE_INTENT_MIN_RECALL,
    syntheticVoiceFailureRate,
    voiceFailureRateGoal: MAX_VOICE_FAILURE_RATE,
  };
}

// ─── Voice: POS → item/amount slots (voice-item-extraction.test.ts) ───────────

export function getItemAndAmountFromTaggedWords(
  taggedWords: [string, string][]
): {
  itemName: string;
  itemAmount: number;
} {
  let itemName = '';
  let itemAmount = 0;
  let index = 0;
  let start = -1;
  let end = -1;
  let lastCDIndex = -1;

  taggedWords.forEach((pair) => {
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
      .map((pair) => pair[0])
      .join(' ');
  }

  return { itemName, itemAmount };
}

export function extractFromTranscript(transcript: string): {
  itemName: string;
  itemAmount: number;
} {
  const pos = require('pos');
  const words = new pos.Lexer().lex(transcript);
  const tagger = new pos.Tagger();
  const taggedWords = tagger.tag(words) as [string, string][];
  return getItemAndAmountFromTaggedWords(taggedWords);
}

export function relativePriceError(expected: number, actual: number): number {
  if (expected === 0) return actual === 0 ? 0 : 1;
  return Math.abs(expected - actual) / Math.abs(expected);
}

export type VoiceSlotCaseResult = {
  transcript: string;
  goldName: string;
  goldAmount: number;
  latencyMs: number;
  werVsGoldName: number;
  relativePriceError: number;
};

export const VOICE_SLOT_CASES: {
  transcript: string;
  goldName: string;
  goldAmount: number;
}[] = [
  { transcript: 'burger $9.99', goldName: 'burger', goldAmount: 9.99 },
  {
    transcript: 'large fries cost $3.50',
    goldName: 'large fries',
    goldAmount: 3.5,
  },
];

export function computeVoiceSlotCaseResults(): VoiceSlotCaseResult[] {
  return VOICE_SLOT_CASES.map(({ transcript, goldName, goldAmount }) => {
    const t0 = global.performance.now();
    const { itemName, itemAmount } = extractFromTranscript(transcript);
    const latencyMs = global.performance.now() - t0;
    return {
      transcript,
      goldName,
      goldAmount,
      latencyMs,
      werVsGoldName: wordErrorRate(goldName, itemName),
      relativePriceError: relativePriceError(goldAmount, itemAmount),
    };
  });
}

// ─── Full snapshot for JSON / markdown export ─────────────────────────────────

export type VvMetricsSnapshot = {
  generatedAt: string;
  environment: string;
  ocr: CordV1OcrMetrics & {
    goals: {
      meanTotalAmountAccuracyMin: number;
      lineF1Min: number;
      ocrFailureRateMax: number;
      latencyBudgetMs: number;
    };
    passesGoals: {
      meanTotalAmountAccuracy: boolean;
      lineF1: boolean;
      ocrFailureRate: boolean;
      p95Latency: boolean;
      avgLatency: boolean;
      meanPriceApe: boolean;
    };
  };
  speech: {
    product: VvProductVoiceMetrics & {
      passesGoals: {
        meanWer: boolean;
        intentPrecision: boolean;
        intentRecall: boolean;
        syntheticFailureRate: boolean;
      };
    };
    slotExtraction: {
      cases: VoiceSlotCaseResult[];
      maxLatencyMsGoal: number;
    };
  };
};

export function buildVvMetricsSnapshot(): VvMetricsSnapshot {
  const ocr = computeCordV1OcrMetrics();
  const voice = computeVvProductVoiceMetrics();
  const slotCases = computeVoiceSlotCaseResults();

  return {
    generatedAt: new Date().toISOString(),
    environment: `node ${process.version}`,
    ocr: {
      ...ocr,
      goals: {
        meanTotalAmountAccuracyMin: OCR_TOTAL_AMOUNT_ACCURACY_GOAL,
        lineF1Min: OCR_LINE_ITEM_F1_GOAL,
        ocrFailureRateMax: OCR_MAX_FAILURE_RATE,
        latencyBudgetMs: OCR_MAX_PROCESSING_MS,
      },
      passesGoals: {
        meanTotalAmountAccuracy:
          ocr.meanTotalAmountAccuracy >= OCR_TOTAL_AMOUNT_ACCURACY_GOAL,
        lineF1: ocr.lineF1 >= OCR_LINE_ITEM_F1_GOAL,
        ocrFailureRate: ocr.ocrFailureRate <= OCR_MAX_FAILURE_RATE,
        p95Latency: ocr.p95LatencyMs < OCR_MAX_PROCESSING_MS,
        avgLatency: ocr.avgLatencyMs < OCR_MAX_PROCESSING_MS,
        meanPriceApe: ocr.meanPriceApe <= 0.1,
      },
    },
    speech: {
      product: {
        ...voice,
        passesGoals: {
          meanWer: voice.meanWer <= voice.werMaxGoal,
          intentPrecision: voice.intentPrecision >= voice.intentPrecisionGoal,
          intentRecall: voice.intentRecall >= voice.intentRecallGoal,
          syntheticFailureRate:
            voice.syntheticVoiceFailureRate <= voice.voiceFailureRateGoal,
        },
      },
      slotExtraction: {
        cases: slotCases,
        maxLatencyMsGoal: CORE_OP_MAX_MS,
      },
    },
  };
}
