import type { PriceLevel } from '@/api/places/places-api';

const PRICE_LABELS: Record<PriceLevel, string> = {
  FREE: 'Free',
  INEXPENSIVE: 'Inexpensive ($)',
  MODERATE: 'Moderate ($$)',
  EXPENSIVE: 'Expensive ($$$)',
  VERY_EXPENSIVE: 'Very expensive ($$$$)',
};

export function formatPriceLevelForDisplay(
  level: PriceLevel | undefined
): string | null {
  if (!level) return null;
  return PRICE_LABELS[level] ?? null;
}

/** Google Places primary type, e.g. `italian_restaurant` → "Italian Restaurant" */
export function formatPlaceCategoryLabel(
  primaryType: string | undefined
): string | null {
  if (!primaryType) return null;
  return primaryType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
