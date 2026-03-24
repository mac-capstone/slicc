export const TIP_PERCENT_OPTIONS = [0, 10, 15, 20, 25] as const;

export type TipPercentOption = (typeof TIP_PERCENT_OPTIONS)[number];

export function isTipPercentOption(n: number): n is TipPercentOption {
  return (TIP_PERCENT_OPTIONS as readonly number[]).includes(n);
}

/**
 * Maps stored values to an allowed option: exact matches stay; legacy values
 * (e.g. 18) snap to the nearest option in {@link TIP_PERCENT_OPTIONS}.
 */
export function normalizeStoredTipPercent(
  n: number | undefined
): TipPercentOption {
  if (n === undefined || Number.isNaN(n)) return 0;
  if (isTipPercentOption(n)) return n;
  if (n <= 0) return 0;
  let nearest: TipPercentOption = 0;
  let bestDistance = Infinity;
  for (const option of TIP_PERCENT_OPTIONS) {
    const distance = Math.abs(n - option);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = option;
    }
  }
  return nearest;
}

export const TIP_PERCENT_SELECT_OPTIONS = TIP_PERCENT_OPTIONS.map((p) => ({
  label: `${p}%`,
  value: String(p),
}));
