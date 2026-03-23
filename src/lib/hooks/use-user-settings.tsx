import React from 'react';
import { useMMKVString } from 'react-native-mmkv';

import { normalizeDietaryPreferenceIds } from '../dietary-preference-options';
import { storage } from '../storage';

const DEFAULT_TAX_RATE_KEY = 'DEFAULT_TAX_RATE';
const DEFAULT_TIP_PERCENT_KEY = 'DEFAULT_TIP_PERCENT';
const DIETARY_PREFERENCE_IDS_KEY = 'DIETARY_PREFERENCE_IDS';
const PAYOUT_EMAIL_KEY = 'PAYOUT_EMAIL';
const BANK_PAYOUT_INSTRUCTIONS_KEY = 'BANK_PAYOUT_INSTRUCTIONS';

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

export const getDefaultTaxRate = (): number =>
  parseStoredNumber(storage.getString(DEFAULT_TAX_RATE_KEY));

export const getDefaultTipPercent = (): number =>
  parseStoredNumber(storage.getString(DEFAULT_TIP_PERCENT_KEY));

export const getDietaryPreferenceIds = (): string[] =>
  parseDietaryIds(storage.getString(DIETARY_PREFERENCE_IDS_KEY));

export const useUserSettings = () => {
  const [taxRateStr, setTaxRateStr] = useMMKVString(
    DEFAULT_TAX_RATE_KEY,
    storage
  );
  const [tipPercentStr, setTipPercentStr] = useMMKVString(
    DEFAULT_TIP_PERCENT_KEY,
    storage
  );
  const [dietaryIdsJson, setDietaryIdsJson] = useMMKVString(
    DIETARY_PREFERENCE_IDS_KEY,
    storage
  );
  const [payoutEmail, setPayoutEmailStr] = useMMKVString(
    PAYOUT_EMAIL_KEY,
    storage
  );
  const [bankPayoutInstructions, setBankPayoutInstructionsStr] = useMMKVString(
    BANK_PAYOUT_INSTRUCTIONS_KEY,
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

  const setBankPayoutInstructions = React.useCallback(
    (value: string) => {
      setBankPayoutInstructionsStr(value);
    },
    [setBankPayoutInstructionsStr]
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
    bankPayoutInstructions: bankPayoutInstructions ?? '',
    setBankPayoutInstructions,
  } as const;
};
