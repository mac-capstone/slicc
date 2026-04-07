/**
 * V&V — product-level metrics from the written plan (goals vs harness / synthetic checks).
 * No live Gemini or external API calls; values are computed from mocks or toy data.
 */

/** OCR: total amount extraction goal (critical). */
const OCR_TOTAL_ACCURACY_GOAL = 0.9;
/** OCR: line-item extraction goal (acceptable with manual edit). */
const OCR_LINE_ITEM_ACCURACY_GOAL = 0.8;
/** OCR: end-to-end processing budget (mid-range device), ms. */
const OCR_MAX_PROCESSING_MS = 5000;
/** OCR: failure rate ceiling (1 - success rate). */
const OCR_MAX_FAILURE_RATE = 0.1;

/** Voice: WER ceiling (≥85% word correctness). */
const VOICE_MAX_WER = 0.15;
/** Voice: intent detection goals. */
const VOICE_INTENT_MIN_PRECISION = 0.85;
const VOICE_INTENT_MIN_RECALL = 0.8;
/** Voice / other core ops processing budget, ms. */
const CORE_OP_MAX_MS = 3000;

/** System: voice/OCR failure tolerance (documented; harness uses synthetic counts). */
const MAX_VOICE_FAILURE_RATE = 0.1;

/** Task completion: full workflow budget (planning + split + pay), seconds. */
const TASK_COMPLETION_GOAL_SECONDS = 120;

/** Content recommendation: F1 @ K goal. */
const RECOMMENDATION_MIN_F1 = 0.65;

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

type VoiceIntent = 'add_line_item' | 'split_bill' | 'other';

function classifyVoiceIntent(transcript: string): VoiceIntent {
  const t = transcript.toLowerCase();
  if (/\bsplit\b|\bdivide\b|\bshare\s+the\b/.test(t)) return 'split_bill';
  if (/\$|add\b|charge\b|item\b|burger|fries|coffee|pizza/.test(t))
    return 'add_line_item';
  return 'other';
}

function precisionRecallIntents(
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
    const outcomes = [
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
    const failureRate = outcomes.filter((ok) => !ok).length / outcomes.length;
    console.info(
      `[V&V voice failure rate] ${failureRate.toFixed(2)} goal≤${MAX_VOICE_FAILURE_RATE}`
    );
    expect(failureRate).toBeLessThanOrEqual(MAX_VOICE_FAILURE_RATE);
  });
});
