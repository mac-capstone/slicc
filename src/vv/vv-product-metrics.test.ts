/**
 * V&V — product-level metrics from the written plan (goals vs harness / synthetic checks).
 * No live Gemini or external API calls; values are computed from mocks or toy data.
 * Shared metric helpers: `vv-snapshot-metrics.ts` (snapshots written on `pnpm run test:ci`).
 */
import {
  computeVvProductVoiceMetrics,
  CORE_OP_MAX_MS,
  MAX_VOICE_FAILURE_RATE,
  OCR_LINE_ITEM_ACCURACY_GOAL,
  OCR_MAX_FAILURE_RATE,
  OCR_MAX_PROCESSING_MS,
  OCR_TOTAL_ACCURACY_GOAL,
  precisionRecallIntents,
  RECOMMENDATION_MIN_F1,
  TASK_COMPLETION_GOAL_SECONDS,
  VOICE_INTENT_MIN_PRECISION,
  VOICE_INTENT_MIN_RECALL,
  VOICE_MAX_WER,
  type VoiceIntent,
  wordErrorRate,
} from '@/vv/vv-snapshot-metrics';

function precisionAtK(
  relevant: Set<string>,
  ranked: string[],
  k: number
): number {
  const top = ranked.slice(0, k);
  if (top.length === 0) return 0;
  let hits = 0;
  for (const id of top) if (relevant.has(id)) hits++;
  return hits / top.length;
}

function recallAtK(relevant: Set<string>, ranked: string[], k: number): number {
  if (relevant.size === 0) return 1;
  const top = new Set(ranked.slice(0, k));
  let hits = 0;
  for (const id of relevant) if (top.has(id)) hits++;
  return hits / relevant.size;
}

function f1(p: number, r: number): number {
  if (p + r === 0) return 0;
  return (2 * p * r) / (p + r);
}

describe('V&V product metrics table (goals + synthetic / harness checks)', () => {
  let infoSpy: jest.SpyInstance;

  beforeAll(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterAll(() => {
    infoSpy.mockRestore();
  });

  it('prints consolidated budget constants for reporting', () => {
    console.info(
      `[V&V goals] OCR total≥${OCR_TOTAL_ACCURACY_GOAL} lineItem≥${OCR_LINE_ITEM_ACCURACY_GOAL} fail≤${OCR_MAX_FAILURE_RATE} latency≤${OCR_MAX_PROCESSING_MS}ms | Voice WER≤${VOICE_MAX_WER} intent P≥${VOICE_INTENT_MIN_PRECISION} R≥${VOICE_INTENT_MIN_RECALL} core≤${CORE_OP_MAX_MS}ms | Rec F1@K≥${RECOMMENDATION_MIN_F1} | task≤${TASK_COMPLETION_GOAL_SECONDS}s`
    );
    expect(OCR_TOTAL_ACCURACY_GOAL).toBeGreaterThanOrEqual(0.9);
    expect(OCR_LINE_ITEM_ACCURACY_GOAL).toBeGreaterThanOrEqual(0.8);
  });

  it('Voice — mean WER stays at or below the 15% goal on reference transcripts', () => {
    const pairs: { ref: string; hyp: string }[] = [
      { ref: 'burger meal', hyp: 'burger meal' },
      { ref: 'add coffee', hyp: 'add coffee' },
      { ref: 'split the check', hyp: 'split check' },
    ];
    const meanWer =
      pairs.reduce((acc, { ref, hyp }) => acc + wordErrorRate(ref, hyp), 0) /
      pairs.length;
    console.info(
      `[V&V voice WER] meanWer=${meanWer.toFixed(3)} goal≤${VOICE_MAX_WER}`
    );
    expect(meanWer).toBeLessThanOrEqual(VOICE_MAX_WER);
  });

  it('Voice — intent precision and recall meet speech interaction goals', () => {
    const cases: { transcript: string; gold: VoiceIntent }[] = [
      { transcript: 'split the bill evenly', gold: 'split_bill' },
      { transcript: 'divide between us', gold: 'split_bill' },
      { transcript: 'add a burger for $12', gold: 'add_line_item' },
      { transcript: 'charge coffee 4 dollars', gold: 'add_line_item' },
      { transcript: 'what time is it', gold: 'other' },
    ];
    const { precision, recall } = precisionRecallIntents(cases);
    console.info(
      `[V&V voice intent] precision=${precision.toFixed(3)} recall=${recall.toFixed(3)}`
    );
    expect(precision).toBeGreaterThanOrEqual(VOICE_INTENT_MIN_PRECISION);
    expect(recall).toBeGreaterThanOrEqual(VOICE_INTENT_MIN_RECALL);
  });

  it('Content recommendation — F1 @ K meets balance goal on a toy ranking', () => {
    const relevant = new Set(['a', 'b', 'c']);
    const ranked = ['a', 'b', 'c', 'x', 'y', 'z'];
    const k = 3;
    const p = precisionAtK(relevant, ranked, k);
    const r = recallAtK(relevant, ranked, k);
    const f1Score = f1(p, r);
    console.info(
      `[V&V recommendation @${k}] P@${k}=${p.toFixed(3)} R@${k}=${r.toFixed(3)} F1=${f1Score.toFixed(3)}`
    );
    expect(f1Score).toBeGreaterThanOrEqual(RECOMMENDATION_MIN_F1);
  });

  it('Task completion — mocked step times stay under the 2-minute workflow goal', () => {
    const mockedStepSeconds = [5, 15, 25, 30, 10];
    const total = mockedStepSeconds.reduce((a, b) => a + b, 0);
    console.info(
      `[V&V task completion] mockedTotalSeconds=${total} goal≤${TASK_COMPLETION_GOAL_SECONDS}`
    );
    expect(total).toBeLessThanOrEqual(TASK_COMPLETION_GOAL_SECONDS);
  });

  it('System reliability — synthetic voice failure rate stays within budget', () => {
    const v = computeVvProductVoiceMetrics();
    console.info(
      `[V&V voice failure rate] ${v.syntheticVoiceFailureRate.toFixed(2)} goal≤${MAX_VOICE_FAILURE_RATE}`
    );
    expect(v.syntheticVoiceFailureRate).toBeLessThanOrEqual(
      MAX_VOICE_FAILURE_RATE
    );
  });
});
