import React from 'react';
import { useMMKVString } from 'react-native-mmkv';

import { storage } from '../storage';

const DEFAULT_TAX_RATE_KEY = 'DEFAULT_TAX_RATE';

/**
 * Hook to get/set the user's default tax rate (stored as a percentage string in MMKV).
 * Returns `defaultTaxRate` as a number (e.g. 8.5 for 8.5%) and a setter.
 * Defaults to 0 if not set.
 */
export const useDefaultTaxRate = () => {
  const [rateStr, _setRateStr] = useMMKVString(DEFAULT_TAX_RATE_KEY, storage);

  const defaultTaxRate = rateStr ? parseFloat(rateStr) : 0;

  const setDefaultTaxRate = React.useCallback(
    (rate: number) => {
      _setRateStr(rate.toString());
    },
    [_setRateStr]
  );

  return { defaultTaxRate, setDefaultTaxRate } as const;
};

/**
 * Non-hook helper to read the default tax rate synchronously from MMKV.
 */
export const getDefaultTaxRate = (): number => {
  const rateStr = storage.getString(DEFAULT_TAX_RATE_KEY);
  return rateStr ? parseFloat(rateStr) : 0;
};
