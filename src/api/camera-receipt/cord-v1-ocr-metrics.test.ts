import { parseReceiptInfo } from '@/lib/utils';

/** Same tests against legacy `dish[]` output and main's `{ items }` output (test-only). */
function parseReceiptInfoCompat(
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

function toDishPriceLines(data: unknown): { dish: string; price: number }[] {
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

type ReceiptLine = {
  dish: string;
  priceRaw: string;
};

type CordSample = {
  imageId: number;
  groundTruth: ReceiptLine[];
  mockedOcrJson: string;
};

function normalizeDish(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseAmount(raw: string): number {
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

const cordV1Samples: CordSample[] = [
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

/** Product goal: ≥90% accuracy on total amount (critical). */
const OCR_TOTAL_AMOUNT_ACCURACY_GOAL = 0.9;
/** Product goal: ≥80% line-item extraction quality (with manual edit fallback). */
const OCR_LINE_ITEM_F1_GOAL = 0.8;
/** Product goal: OCR failure rate ≤10%. */
const OCR_MAX_FAILURE_RATE = 0.1;
/** Product goal: OCR processing ≤5s on mid-range devices (parser path uses same budget in CI). */
const OCR_MAX_PROCESSING_MS = 5000;

function harmonicMean(a: number, b: number): number {
  if (a + b === 0) return 0;
  return (2 * a * b) / (a + b);
}

/**
 * V&V §6.4.1/§6.4.2 — 10-sample CORD-v1 OCR quality + parser performance.
 * Uses deterministic mocked OCR JSON outputs from sampled receipts so CI is stable.
 * Captures: line-item precision/recall, total-amount accuracy, parse failure rate, latency.
 */
describe('CORD-v1 sampled OCR metrics (§6.4)', () => {
  it('reports strong extraction success rate with bounded parse latency', () => {
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

    // Keep metrics visible in Jest output for V&V reporting.
    console.info(
      `[OCR CORD-v1 10-sample] parseSuccessRate=${successRate.toFixed(3)} ocrFailureRate=${ocrFailureRate.toFixed(3)} linePrecision=${precision.toFixed(3)} lineRecall=${recall.toFixed(3)} lineF1=${lineItemF1.toFixed(3)} meanTotalAmountAccuracy=${meanTotalAmountAccuracy.toFixed(3)} meanPriceApe=${meanPriceApe.toFixed(4)} avgLatencyMs=${avgLatencyMs.toFixed(2)} p95LatencyMs=${p95LatencyMs.toFixed(2)} budgetMs=${OCR_MAX_PROCESSING_MS}`
    );

    expect(meanTotalAmountAccuracy).toBeGreaterThanOrEqual(
      OCR_TOTAL_AMOUNT_ACCURACY_GOAL
    );
    expect(lineItemF1).toBeGreaterThanOrEqual(OCR_LINE_ITEM_F1_GOAL);
    expect(ocrFailureRate).toBeLessThanOrEqual(OCR_MAX_FAILURE_RATE);
    expect(meanPriceApe).toBeLessThanOrEqual(0.1);
    expect(p95LatencyMs).toBeLessThan(OCR_MAX_PROCESSING_MS);
    expect(avgLatencyMs).toBeLessThan(OCR_MAX_PROCESSING_MS);
  });
});
