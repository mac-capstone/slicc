/**
 * Writes `vv-metrics-snapshot/*` when Jest runs with `--coverage` (e.g. `pnpm run test:ci`).
 * Plain `pnpm test` does not pass `--coverage`, so files are left unchanged.
 */
import fs from 'fs';
import path from 'path';

import { buildVvMetricsSnapshot } from '@/vv/vv-snapshot-metrics';

const outDir = path.join(__dirname, 'vv-metrics-snapshot');

/**
 * `pnpm run test:ci` runs `jest --coverage`. The main process has `--coverage` on argv;
 * Jest workers sometimes omit it, so we also check Istanbul's global when coverage is on.
 */
function isCoverageRun(): boolean {
  if (
    process.argv.some(
      (arg) => arg === '--coverage' || arg.startsWith('--coverage=')
    )
  ) {
    return true;
  }
  const g = globalThis as typeof globalThis & {
    __coverage__?: Record<string, unknown> | undefined;
  };
  return g.__coverage__ != null && typeof g.__coverage__ === 'object';
}

function formatOcrMd(s: ReturnType<typeof buildVvMetricsSnapshot>): string {
  const { ocr } = s;
  return [
    '### OCR (CORD-v1 style harness, mocked JSON)',
    '',
    '| Metric | Value | Goal / budget | Pass |',
    '| --- | --- | --- | --- |',
    `| Samples | ${ocr.sampleCount} | — | — |`,
    `| Parse success rate | ${ocr.parseSuccessRate.toFixed(3)} | — | — |`,
    `| OCR failure rate | ${ocr.ocrFailureRate.toFixed(3)} | ≤ ${ocr.goals.ocrFailureRateMax} | ${ocr.passesGoals.ocrFailureRate ? 'yes' : 'no'} |`,
    `| Line precision | ${ocr.linePrecision.toFixed(3)} | — | — |`,
    `| Line recall | ${ocr.lineRecall.toFixed(3)} | — | — |`,
    `| Line F1 | ${ocr.lineF1.toFixed(3)} | ≥ ${ocr.goals.lineF1Min} | ${ocr.passesGoals.lineF1 ? 'yes' : 'no'} |`,
    `| Mean total-amount accuracy | ${ocr.meanTotalAmountAccuracy.toFixed(3)} | ≥ ${ocr.goals.meanTotalAmountAccuracyMin} | ${ocr.passesGoals.meanTotalAmountAccuracy ? 'yes' : 'no'} |`,
    `| Mean price APE | ${ocr.meanPriceApe.toFixed(4)} | ≤ 0.1 | ${ocr.passesGoals.meanPriceApe ? 'yes' : 'no'} |`,
    `| Avg parse latency | ${ocr.avgLatencyMs.toFixed(2)} ms | < ${ocr.budgetMs} ms | ${ocr.passesGoals.avgLatency ? 'yes' : 'no'} |`,
    `| p95 parse latency | ${ocr.p95LatencyMs.toFixed(2)} ms | < ${ocr.budgetMs} ms | ${ocr.passesGoals.p95Latency ? 'yes' : 'no'} |`,
    '',
  ].join('\n');
}

function formatSpeechMd(s: ReturnType<typeof buildVvMetricsSnapshot>): string {
  const { product } = s.speech;
  const { cases, maxLatencyMsGoal } = s.speech.slotExtraction;
  const slotRows = cases
    .map(
      (c) =>
        `| ${c.transcript.replace(/\|/g, '\\|')} | ${c.latencyMs.toFixed(2)} | ${c.werVsGoldName.toFixed(3)} | ${c.relativePriceError.toFixed(4)} |`
    )
    .join('\n');

  return [
    '### Speech-to-text (synthetic / harness)',
    '',
    '**Product-level (intent + WER targets from V&V plan)**',
    '',
    '| Metric | Value | Goal | Pass |',
    '| --- | --- | --- | --- |',
    `| Mean WER (reference pairs) | ${product.meanWer.toFixed(3)} | ≤ ${product.werMaxGoal} | ${product.passesGoals.meanWer ? 'yes' : 'no'} |`,
    `| Intent precision | ${product.intentPrecision.toFixed(3)} | ≥ ${product.intentPrecisionGoal} | ${product.passesGoals.intentPrecision ? 'yes' : 'no'} |`,
    `| Intent recall | ${product.intentRecall.toFixed(3)} | ≥ ${product.intentRecallGoal} | ${product.passesGoals.intentRecall ? 'yes' : 'no'} |`,
    `| Synthetic voice failure rate | ${product.syntheticVoiceFailureRate.toFixed(2)} | ≤ ${product.voiceFailureRateGoal} | ${product.passesGoals.syntheticFailureRate ? 'yes' : 'no'} |`,
    '',
    '**Slot extraction (POS tagger + phrase match; latency bound Section 6.5.2)**',
    '',
    '| Transcript | Latency (ms) | WER vs gold name | Rel. price error |',
    '| --- | --- | --- | --- |',
    slotRows,
    '',
    `Latency goal per case: < ${maxLatencyMsGoal} ms (Jest harness).`,
    '',
  ].join('\n');
}

describe('V&V metrics snapshot export', () => {
  it('writes vv-metrics-snapshot files when running with coverage (test:ci)', () => {
    if (!isCoverageRun()) {
      expect.assertions(0);
      return;
    }

    expect.assertions(2);

    const snapshot = buildVvMetricsSnapshot();
    fs.mkdirSync(outDir, { recursive: true });

    const jsonPath = path.join(outDir, 'vv-metrics-snapshot.json');
    fs.writeFileSync(
      jsonPath,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      'utf8'
    );

    const mdPath = path.join(outDir, 'vv-metrics-snapshot.md');
    const md = [
      '# V&V performance metrics snapshot',
      '',
      `**Generated:** ${snapshot.generatedAt}  `,
      `**Environment:** ${snapshot.environment}  `,
      '',
      '> Written when Jest runs with `--coverage` (e.g. `pnpm run test:ci`). Deterministic mocked OCR JSON and synthetic transcripts (no live Gemini or microphone).',
      '',
      formatOcrMd(snapshot),
      formatSpeechMd(snapshot),
      '---',
      '',
      'Machine-readable copy: `vv-metrics-snapshot.json` in this folder.',
      '',
    ].join('\n');
    fs.writeFileSync(mdPath, md, 'utf8');

    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);
  });
});
