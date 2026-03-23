export const DIETARY_PREFERENCE_IDS = [
  'vegetarian',
  'vegan',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'no_shellfish',
  'no_pork',
] as const;

export type DietaryPreferenceId = (typeof DIETARY_PREFERENCE_IDS)[number];

export const VALID_DIETARY_IDS = new Set<string>(DIETARY_PREFERENCE_IDS);

export function normalizeDietaryPreferenceIds(
  raw: readonly string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    if (VALID_DIETARY_IDS.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
