import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useUser } from '@/api/people/use-users';
import { updateUserSettingsInFirestore } from '@/api/people/user-api';
import { useAuth } from '@/lib/auth';
import { normalizeDietaryPreferenceIds } from '@/lib/dietary-preference-options';
import { useUserSettings } from '@/lib/hooks/use-user-settings';
import { isBankPreference } from '@/lib/payment-utils';
import {
  formatPercent,
  mapFirestoreDietaryToIds,
  normalizeTextValue,
  validateEmail,
  validatePercent,
} from '@/lib/settings-screen-helpers';
import {
  isTipPercentOption,
  normalizeStoredTipPercent,
} from '@/lib/tip-percent-options';
import { type BankPreference } from '@/types';

export function useSettingsScreen() {
  const userId = useAuth.use.userId();
  const queryClient = useQueryClient();

  const { data: user } = useUser({
    variables: userId ?? undefined,
    enabled: Boolean(userId),
  });

  const {
    defaultTaxRate,
    setDefaultTaxRate,
    defaultTipPercent,
    setDefaultTipPercent,
    dietaryPreferenceIds,
    setDietaryPreferenceIds,
    payoutEmail,
    setPayoutEmail,
    bankPayoutInstructions,
    setBankPayoutInstructions,
  } = useUserSettings();

  const [taxRateInput, setTaxRateInput] = useState(
    formatPercent(defaultTaxRate)
  );
  const [payoutEmailInput, setPayoutEmailInput] = useState(payoutEmail);
  const [bankInstructionsInput, setBankInstructionsInput] = useState(
    bankPayoutInstructions
  );
  const [locationPreference, setLocationPreference] = useState('');
  const [bankPreference, setBankPreference] = useState<BankPreference>('none');
  const [taxRateError, setTaxRateError] = useState<string | null>(null);
  const [payoutEmailError, setPayoutEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.defaultTaxRate !== undefined) {
      setDefaultTaxRate(user.defaultTaxRate);
    } else {
      setDefaultTaxRate(0);
    }
    if (user.defaultTipRate !== undefined) {
      setDefaultTipPercent(normalizeStoredTipPercent(user.defaultTipRate));
    } else {
      setDefaultTipPercent(0);
    }
    setDietaryPreferenceIds(
      mapFirestoreDietaryToIds(user.dietaryPreferences ?? [])
    );
    setLocationPreference(user.locationPreference ?? '');
    setPayoutEmail(user.eTransferEmail ?? '');
    setBankPreference(user.bankPreference ?? 'none');
  }, [
    user,
    setDefaultTaxRate,
    setDefaultTipPercent,
    setDietaryPreferenceIds,
    setPayoutEmail,
  ]);

  useEffect(() => {
    setTaxRateInput(formatPercent(defaultTaxRate));
  }, [defaultTaxRate]);

  useEffect(() => {
    setPayoutEmailInput(payoutEmail);
  }, [payoutEmail]);

  useEffect(() => {
    setBankInstructionsInput(bankPayoutInstructions);
  }, [bankPayoutInstructions]);

  const persistToFirestore = useCallback(
    async (data: Parameters<typeof updateUserSettingsInFirestore>[1]) => {
      if (!userId) return;
      await updateUserSettingsInFirestore(userId, data);
      await queryClient.invalidateQueries({ queryKey: ['users', 'userId'] });
    },
    [queryClient, userId]
  );

  const saveTaxRate = useCallback(async () => {
    const error = validatePercent(taxRateInput);
    if (error) {
      setTaxRateError(error);
      return;
    }

    const parsed =
      taxRateInput.trim() === '' ? 0 : Number.parseFloat(taxRateInput);
    setDefaultTaxRate(parsed);
    setTaxRateInput(formatPercent(parsed));
    setTaxRateError(null);

    try {
      await persistToFirestore({ defaultTaxRate: parsed });
    } catch (e) {
      console.error('[settings] failed to save tax rate', e);
      Alert.alert(
        'Save failed',
        'Unable to save your default tax rate. Please try again.'
      );
    }
  }, [persistToFirestore, setDefaultTaxRate, taxRateInput]);

  const handleTipPercentChange = useCallback(
    async (raw: string | number) => {
      const parsed = Number.parseInt(String(raw), 10);
      if (!isTipPercentOption(parsed)) return;

      setDefaultTipPercent(parsed);
      try {
        await persistToFirestore({ defaultTipRate: parsed });
      } catch (e) {
        console.error('[settings] failed to save tip percent', e);
        Alert.alert(
          'Save failed',
          'Unable to save your default tip. Please try again.'
        );
      }
    },
    [persistToFirestore, setDefaultTipPercent]
  );

  const savePayoutEmail = useCallback(async () => {
    const normalizedValue = normalizeTextValue(payoutEmailInput);
    const error = validateEmail(normalizedValue);

    if (error) {
      setPayoutEmailError(error);
      return;
    }

    setPayoutEmail(normalizedValue);
    setPayoutEmailInput(normalizedValue);
    setPayoutEmailError(null);

    try {
      await persistToFirestore({ eTransferEmail: normalizedValue });
    } catch (e) {
      console.error('[settings] failed to save payout email', e);
      Alert.alert(
        'Save failed',
        'Unable to save your e-transfer email. Please try again.'
      );
    }
  }, [payoutEmailInput, persistToFirestore, setPayoutEmail]);

  const saveBankInstructions = useCallback(() => {
    const normalizedValue = normalizeTextValue(bankInstructionsInput);
    setBankPayoutInstructions(normalizedValue);
    setBankInstructionsInput(normalizedValue);
  }, [bankInstructionsInput, setBankPayoutInstructions]);

  const saveLocationPreference = useCallback(async () => {
    const trimmed = locationPreference.trim();
    try {
      await persistToFirestore({ locationPreference: trimmed });
    } catch (e) {
      console.error('[settings] failed to save location', e);
      Alert.alert(
        'Save failed',
        'Unable to save your location preference. Please try again.'
      );
    }
  }, [locationPreference, persistToFirestore]);

  const handleDietaryChange = useCallback(
    async (ids: string[]) => {
      const normalized = normalizeDietaryPreferenceIds(ids);
      setDietaryPreferenceIds(normalized);
      try {
        await persistToFirestore({
          dietaryPreferences: [...normalized],
        });
      } catch (e) {
        console.error('[settings] failed to save dietary preferences', e);
        Alert.alert(
          'Save failed',
          'Unable to save dietary preferences. Please try again.'
        );
      }
    },
    [persistToFirestore, setDietaryPreferenceIds]
  );

  const handleBankPreferenceChange = useCallback(
    async (value: string) => {
      if (typeof value !== 'string' || !isBankPreference(value)) return;
      setBankPreference(value);
      try {
        await persistToFirestore({ bankPreference: value });
      } catch (e) {
        console.error('[settings] failed to save bank preference', e);
        Alert.alert(
          'Save failed',
          'Unable to save your bank preference. Please try again.'
        );
      }
    },
    [persistToFirestore]
  );

  const tipSelectPercent = normalizeStoredTipPercent(defaultTipPercent);

  return {
    bankInstructionsInput,
    bankPreference,
    dietaryPreferenceIds,
    handleBankPreferenceChange,
    handleDietaryChange,
    handleTipPercentChange,
    locationPreference,
    payoutEmailError,
    payoutEmailInput,
    saveBankInstructions,
    saveLocationPreference,
    savePayoutEmail,
    saveTaxRate,
    setBankInstructionsInput,
    setLocationPreference,
    setPayoutEmailError,
    setPayoutEmailInput,
    setTaxRateInput,
    setTaxRateError,
    taxRateError,
    taxRateInput,
    tipSelectPercent,
  } as const;
}
