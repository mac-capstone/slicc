import React, { useMemo, useRef } from 'react';
import { useMMKVString } from 'react-native-mmkv';

import { useAuth } from '@/lib/auth';
import { type UserIdT } from '@/types';

import { normalizeDietaryPreferenceIds } from '../dietary-preference-options';
import { storage } from '../storage';

/** Base key names; persisted keys are `${userId}:${base}` (or `__signed_out__:${base}`). */
export const USER_SETTINGS_DEFAULT_TAX_RATE_KEY = 'DEFAULT_TAX_RATE';
export const USER_SETTINGS_DEFAULT_TIP_PERCENT_KEY = 'DEFAULT_TIP_PERCENT';
export const USER_SETTINGS_DIETARY_IDS_KEY = 'DIETARY_PREFERENCE_IDS';
export const USER_SETTINGS_PAYOUT_EMAIL_KEY = 'PAYOUT_EMAIL';

const USER_SETTINGS_BASE_KEYS = [
  USER_SETTINGS_DEFAULT_TAX_RATE_KEY,
  USER_SETTINGS_DEFAULT_TIP_PERCENT_KEY,
  USER_SETTINGS_DIETARY_IDS_KEY,
  USER_SETTINGS_PAYOUT_EMAIL_KEY,
] as const;

const SIGNED_OUT_SCOPE = '__signed_out__';

export function userSettingsStorageKey(
  userId: UserIdT | null | undefined,
  baseKey: string
): string {
  const scope =
    userId !== null && userId !== undefined && userId !== ''
      ? userId
      : SIGNED_OUT_SCOPE;
  return `${scope}:${baseKey}`;
}

/**
 * One-time move from pre-multi-account global keys to the signed-in user's
 * scoped keys, then delete globals so another account cannot read them.
 */
function migrateLegacyGlobalUserSettings(userId: UserIdT): void {
  const hasLegacy = USER_SETTINGS_BASE_KEYS.some(
    (base) => storage.getString(base) !== undefined
  );
  if (!hasLegacy) return;

  for (const base of USER_SETTINGS_BASE_KEYS) {
    const scopedKey = userSettingsStorageKey(userId, base);
    if (storage.getString(scopedKey) !== undefined) continue;
    const legacy = storage.getString(base);
    if (legacy !== undefined) storage.set(scopedKey, legacy);
  }
  for (const base of USER_SETTINGS_BASE_KEYS) {
    storage.remove(base);
  }
}

const parseStoredNumber = (value?: string): number => {
  if (!value) return 0;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function parseDietaryIds(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const strings = parsed.filter((x): x is string => typeof x === 'string');
    return normalizeDietaryPreferenceIds(strings);
  } catch {
    return [];
  }
}

export function getDefaultTaxRate(userId: UserIdT | null): number {
  return parseStoredNumber(
    storage.getString(
      userSettingsStorageKey(userId, USER_SETTINGS_DEFAULT_TAX_RATE_KEY)
    )
  );
}

export function getDefaultTipPercent(userId: UserIdT | null): number {
  return parseStoredNumber(
    storage.getString(
      userSettingsStorageKey(userId, USER_SETTINGS_DEFAULT_TIP_PERCENT_KEY)
    )
  );
}

export function getDietaryPreferenceIds(userId: UserIdT | null): string[] {
  return parseDietaryIds(
    storage.getString(
      userSettingsStorageKey(userId, USER_SETTINGS_DIETARY_IDS_KEY)
    )
  );
}

export const useUserSettings = () => {
  const userId = useAuth.use.userId();

  const lastMigratedUserIdRef = useRef<UserIdT | null | undefined>(undefined);
  if (userId) {
    if (lastMigratedUserIdRef.current !== userId) {
      lastMigratedUserIdRef.current = userId;
      migrateLegacyGlobalUserSettings(userId);
    }
  } else {
    lastMigratedUserIdRef.current = null;
  }

  const keys = useMemo(
    () => ({
      taxRate: userSettingsStorageKey(
        userId,
        USER_SETTINGS_DEFAULT_TAX_RATE_KEY
      ),
      tipPercent: userSettingsStorageKey(
        userId,
        USER_SETTINGS_DEFAULT_TIP_PERCENT_KEY
      ),
      dietaryIds: userSettingsStorageKey(userId, USER_SETTINGS_DIETARY_IDS_KEY),
      payoutEmail: userSettingsStorageKey(
        userId,
        USER_SETTINGS_PAYOUT_EMAIL_KEY
      ),
    }),
    [userId]
  );

  const [taxRateStr, setTaxRateStr] = useMMKVString(keys.taxRate, storage);
  const [tipPercentStr, setTipPercentStr] = useMMKVString(
    keys.tipPercent,
    storage
  );
  const [dietaryIdsJson, setDietaryIdsJson] = useMMKVString(
    keys.dietaryIds,
    storage
  );
  const [payoutEmail, setPayoutEmailStr] = useMMKVString(
    keys.payoutEmail,
    storage
  );

  const defaultTaxRate = parseStoredNumber(taxRateStr);
  const defaultTipPercent = parseStoredNumber(tipPercentStr);
  const dietaryPreferenceIds = parseDietaryIds(dietaryIdsJson);

  const setDefaultTaxRate = React.useCallback(
    (rate: number) => {
      setTaxRateStr(rate.toString());
    },
    [setTaxRateStr]
  );

  const setDefaultTipPercent = React.useCallback(
    (rate: number) => {
      setTipPercentStr(rate.toString());
    },
    [setTipPercentStr]
  );

  const setDietaryPreferenceIds = React.useCallback(
    (ids: string[]) => {
      const normalized = normalizeDietaryPreferenceIds(ids);
      setDietaryIdsJson(JSON.stringify(normalized));
    },
    [setDietaryIdsJson]
  );

  const setPayoutEmail = React.useCallback(
    (value: string) => {
      setPayoutEmailStr(value);
    },
    [setPayoutEmailStr]
  );

  return {
    defaultTaxRate,
    setDefaultTaxRate,
    defaultTipPercent,
    setDefaultTipPercent,
    dietaryPreferenceIds,
    setDietaryPreferenceIds,
    payoutEmail: payoutEmail ?? '',
    setPayoutEmail,
  } as const;
};
