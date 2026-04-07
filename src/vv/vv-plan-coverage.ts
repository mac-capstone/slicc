/**
 * Maps the V&V Plan (Section 6) to unit/integration test entry points on this branch.
 * Use this file when tracing doc §6.x → automated tests. Items marked “manual/E2E” are
 * exercised outside Jest (snapshot % threshold, Firebase Emulator, multi-screen flows).
 *
 * TA feedback (AI/ML): §6.4 and §6.5 require correctness metrics (precision/recall,
 * price error, WER/slot metrics), not latency alone — see extract-receipt-info and
 * voice-item-extraction tests.
 *
 * §6.6 State management: explicitly out of scope per V&V; covered indirectly via
 * data-layer and component tests.
 */

/** Self-check: `vv-plan-coverage.test.ts` asserts these keys stay in sync with the written plan. */
export const vvPlanCoverage = {
  '6.1.1': {
    label: 'Presentation — unit (UI behaviour, interactions, forms)',
    tests: [
      'src/components/title.test.tsx',
      'src/components/ui/button.test.tsx',
      'src/components/ui/input.test.tsx',
      'src/components/ui/checkbox.test.tsx',
      'src/components/ui/select.test.tsx',
      'src/components/login-form.test.tsx',
    ],
    manualOrE2E:
      'Multi-screen expense / group / event flows: manual or E2E (see V&V §6.1.1 prose).',
  },
  '6.1.2': {
    label: 'Presentation — initial render / interactivity budget (<2s)',
    tests: [
      'src/components/title.test.tsx',
      'src/components/ui/button.test.tsx',
    ],
    note: 'Representative component-level timing checks; full-screen budgets are manual/E2E on devices.',
  },
  '6.1.3': {
    label:
      'Presentation — snapshots (Jest; 90% similarity in E2E/visual pipelines)',
    tests: [
      'src/components/title.test.tsx',
      'src/components/ui/button.test.tsx',
      'src/components/__snapshots__/*.snap',
      'src/components/ui/__snapshots__/*.snap',
    ],
    manualOrE2E:
      'Screenshot / pixel pipelines with ~90% threshold are not duplicated in unit Jest.',
  },
  '6.2.1': {
    label: 'Business — balances, splits, expense rules, helpers',
    tests: [
      'src/api/expenses/use-balances.test.tsx',
      'src/lib/utils.test.ts (calculatePersonShare, parseReceiptInfo, …)',
      'src/lib/utils.vv-performance.test.ts',
      'src/lib/event-utils.test.ts',
      'src/lib/payment-utils.test.ts',
      'src/lib/resolve-user-default-rates.test.ts',
      'src/lib/tip-percent-options.test.ts',
      'src/lib/date-utils.test.ts',
      'src/lib/dietary-preference-options.test.ts',
      'src/lib/settings-screen-helpers.test.ts',
      'src/lib/group-preferences.test.ts',
      'src/api/expenses/use-expenses-mutations.test.tsx (cache invalidation after create)',
    ],
    manualOrE2E:
      'Notification UX and push flows: not isolated in unit tests; seed/scripts reference notifications data.',
  },
  '6.2.2': {
    label: 'Business — expense math responsiveness (<200ms)',
    tests: ['src/lib/utils.vv-performance.test.ts'],
  },
  '6.3.1': {
    label: 'Data — fetch/cache/mutations (mocked API)',
    tests: [
      'src/api/expenses/use-balances.test.tsx',
      'src/api/expenses/use-expenses-mutations.test.tsx',
      'src/lib/hooks/use-user-settings.test.tsx',
    ],
  },
  '6.3.2': {
    label: 'Data — API responsiveness (<500ms average, mocked)',
    tests: ['src/api/expenses/use-balances.vv-data-performance.test.tsx'],
  },
  '6.4.1': {
    label: 'Gemini — request shape + response parsing (mocked)',
    tests: ['src/api/camera-receipt/extract-receipt-info.test.ts'],
  },
  '6.4.2': {
    label: 'Gemini — latency + TA quality metrics (precision/recall/price)',
    tests: ['src/api/camera-receipt/extract-receipt-info.test.ts'],
  },
  '6.5.1': {
    label: 'Voice / NLP — structured slots + error-style cases',
    tests: ['src/vv/voice-item-extraction.test.ts'],
  },
  '6.5.2': {
    label: 'Voice — latency (<3s) + TA metrics (WER, price error)',
    tests: ['src/vv/voice-item-extraction.test.ts'],
  },
  '6.6': {
    label: 'State management — excluded per V&V; verified via data/UI tests',
    tests: ['(n/a — see §6.3 / component hooks)'],
  },
  '6.7.1': {
    label: 'Infra — validation / auth-shaped payloads (client Zod)',
    tests: [
      'src/types/schema.validation.test.ts',
      'src/lib/crypto/e2e-crypto.test.ts (E2E crypto primitives for chat keys)',
    ],
    manualOrE2E:
      'Firebase Emulator auth rules, Storage, and production security: manual or integration suite per V&V.',
  },
  '6.7.2': {
    label: 'Infra — DB/auth latency (<500ms / <1s)',
    tests: ['src/vv/vv-infra-scope.test.ts'],
    manualOrE2E:
      'Average DB and auth latency are validated with Emulator or staging instrumentation, not unit Jest timers.',
  },
} as const;
