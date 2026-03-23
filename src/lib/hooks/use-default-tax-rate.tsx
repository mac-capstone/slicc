import React from 'react';

import { useUserSettings } from './use-user-settings';

export const useDefaultTaxRate = () => {
  const { defaultTaxRate, setDefaultTaxRate } = useUserSettings();

  return React.useMemo(
    () => ({ defaultTaxRate, setDefaultTaxRate }) as const,
    [defaultTaxRate, setDefaultTaxRate]
  );
};
