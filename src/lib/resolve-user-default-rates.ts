import { type UserWithId } from '@/types';

/**
 * When the signed-in user doc has no saved rate, use `0` — not device MMKV
 * (which may still hold another account’s or an old session’s values).
 */
export function resolveDefaultTaxRate(
  user: UserWithId | null | undefined,
  mmkvFallback: number
): number {
  if (user == null) return mmkvFallback;
  return user.defaultTaxRate !== undefined ? user.defaultTaxRate : 0;
}

export function resolveDefaultTipRate(
  user: UserWithId | null | undefined,
  mmkvFallback: number
): number {
  if (user == null) return mmkvFallback;
  return user.defaultTipRate !== undefined ? user.defaultTipRate : 0;
}
