export const TIP_PERCENT_OPTIONS = [0, 10, 15, 20, 25] as const;

export type TipPercentOption = (typeof TIP_PERCENT_OPTIONS)[number];

export function isTipPercentOption(n: number): n is TipPercentOption {
  return (TIP_PERCENT_OPTIONS as readonly number[]).includes(n);
}

/** Maps stored values to the nearest allowed option; unknown values become `0`. */
export function normalizeStoredTipPercent(
  n: number | undefined
): TipPercentOption {
  if (n === undefined || Number.isNaN(n)) return 0;
  return isTipPercentOption(n) ? n : 0;
}

export const TIP_PERCENT_SELECT_OPTIONS = TIP_PERCENT_OPTIONS.map((p) => ({
  label: `${p}%`,
  value: String(p),
}));
