import {
  computeCordV1OcrMetrics,
  OCR_LINE_ITEM_F1_GOAL,
  OCR_MAX_FAILURE_RATE,
  OCR_MAX_PROCESSING_MS,
  OCR_TOTAL_AMOUNT_ACCURACY_GOAL,
} from '@/vv/vv-snapshot-metrics';

/**
 * V&V §6.4.1/§6.4.2 — 10-sample CORD-v1 OCR quality + parser performance.
 * Uses deterministic mocked OCR JSON outputs from sampled receipts so CI is stable.
 * Metrics implementation: `src/vv/vv-snapshot-metrics.ts` (V&V files updated on `pnpm run test:ci`).
 */
describe('CORD-v1 sampled OCR metrics (§6.4)', () => {
  let infoSpy: jest.SpyInstance;

  beforeAll(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterAll(() => {
    infoSpy.mockRestore();
  });

  it('reports strong extraction success rate with bounded parse latency', () => {
    const m = computeCordV1OcrMetrics();

    console.info(
      `[OCR CORD-v1 10-sample] parseSuccessRate=${m.parseSuccessRate.toFixed(3)} ocrFailureRate=${m.ocrFailureRate.toFixed(3)} linePrecision=${m.linePrecision.toFixed(3)} lineRecall=${m.lineRecall.toFixed(3)} lineF1=${m.lineF1.toFixed(3)} meanTotalAmountAccuracy=${m.meanTotalAmountAccuracy.toFixed(3)} meanPriceApe=${m.meanPriceApe.toFixed(4)} avgLatencyMs=${m.avgLatencyMs.toFixed(2)} p95LatencyMs=${m.p95LatencyMs.toFixed(2)} budgetMs=${OCR_MAX_PROCESSING_MS}`
    );

    expect(m.meanTotalAmountAccuracy).toBeGreaterThanOrEqual(
      OCR_TOTAL_AMOUNT_ACCURACY_GOAL
    );
    expect(m.lineF1).toBeGreaterThanOrEqual(OCR_LINE_ITEM_F1_GOAL);
    expect(m.ocrFailureRate).toBeLessThanOrEqual(OCR_MAX_FAILURE_RATE);
    expect(m.meanPriceApe).toBeLessThanOrEqual(0.1);
    expect(m.p95LatencyMs).toBeLessThan(OCR_MAX_PROCESSING_MS);
    expect(m.avgLatencyMs).toBeLessThan(OCR_MAX_PROCESSING_MS);
  });
});
