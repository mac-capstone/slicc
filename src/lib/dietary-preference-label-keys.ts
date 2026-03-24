import type { DietaryPreferenceId } from './dietary-preference-options';
import type { TxKeyPath } from './i18n/utils';

export const DIETARY_LABEL_KEYS = {
  vegetarian: 'settings.dietary_option_vegetarian',
  vegan: 'settings.dietary_option_vegan',
  halal: 'settings.dietary_option_halal',
  kosher: 'settings.dietary_option_kosher',
  gluten_free: 'settings.dietary_option_gluten_free',
  dairy_free: 'settings.dietary_option_dairy_free',
  nut_free: 'settings.dietary_option_nut_free',
  no_shellfish: 'settings.dietary_option_no_shellfish',
  no_pork: 'settings.dietary_option_no_pork',
} as const satisfies Record<DietaryPreferenceId, TxKeyPath>;
