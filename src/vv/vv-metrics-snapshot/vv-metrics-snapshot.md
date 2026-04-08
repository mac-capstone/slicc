# V&V performance metrics snapshot

**Generated:** 2026-04-08T02:23:02.141Z  
**Environment:** node v24.11.0

> Written when Jest runs with `--coverage` (e.g. `pnpm run test:ci`). Deterministic mocked OCR JSON and synthetic transcripts (no live Gemini or microphone).

### OCR (CORD-v1 style harness, mocked JSON)

| Metric                     | Value   | Goal / budget | Pass |
| -------------------------- | ------- | ------------- | ---- |
| Samples                    | 10      | —             | —    |
| Parse success rate         | 1.000   | —             | —    |
| OCR failure rate           | 0.000   | ≤ 0.1         | yes  |
| Line precision             | 1.000   | —             | —    |
| Line recall                | 1.000   | —             | —    |
| Line F1                    | 1.000   | ≥ 0.8         | yes  |
| Mean total-amount accuracy | 0.995   | ≥ 0.9         | yes  |
| Mean price APE             | 0.0029  | ≤ 0.1         | yes  |
| Avg parse latency          | 1.10 ms | < 5000 ms     | yes  |
| p95 parse latency          | 6.00 ms | < 5000 ms     | yes  |

### Speech-to-text (synthetic / harness)

**Product-level (intent + WER targets from V&V plan)**

| Metric                       | Value | Goal   | Pass |
| ---------------------------- | ----- | ------ | ---- |
| Mean WER (reference pairs)   | 0.111 | ≤ 0.15 | yes  |
| Intent precision             | 1.000 | ≥ 0.85 | yes  |
| Intent recall                | 1.000 | ≥ 0.8  | yes  |
| Synthetic voice failure rate | 0.10  | ≤ 0.1  | yes  |

**Slot extraction (POS tagger + phrase match; latency bound Section 6.5.2)**

| Transcript             | Latency (ms) | WER vs gold name | Rel. price error |
| ---------------------- | ------------ | ---------------- | ---------------- |
| burger $9.99           | 351.00       | 0.000            | 0.0000           |
| large fries cost $3.50 | 1.00         | 0.500            | 0.0000           |

Latency goal per case: < 3000 ms (Jest harness).

---

Machine-readable copy: `vv-metrics-snapshot.json` in this folder.
