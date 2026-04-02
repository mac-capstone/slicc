import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { type BankPreference, type UserIdT } from '@/types';

export function useSettingsScreen() {
  const userId = useAuth.use.userId();
  const viewerUserId = userId ?? null;
  const queryClient = useQueryClient();

  const { data: user } = useUser({
    variables: { userId: userId as UserIdT, viewerUserId },
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
  } = useUserSettings();

  const [taxRateInput, setTaxRateInput] = useState(
    formatPercent(defaultTaxRate)
  );
  const [payoutEmailInput, setPayoutEmailInput] = useState(payoutEmail);
  const [locationPreference, setLocationPreference] = useState('');
  const [bankPreference, setBankPreference] = useState<BankPreference>('none');
  const [taxRateError, setTaxRateError] = useState<string | null>(null);
  const [payoutEmailError, setPayoutEmailError] = useState<string | null>(null);

  /** Firestore refetches replace `user` by reference; seed local state only once per account. */
  const hydratedUserIdRef = useRef<string | undefined>(undefined);
  const taxDirtyRef = useRef(false);
  const payoutEmailDirtyRef = useRef(false);
  const locationDirtyRef = useRef(false);

  useEffect(() => {
    if (!user) {
      hydratedUserIdRef.current = undefined;
      return;
    }
    if (hydratedUserIdRef.current === user.id) return;

    hydratedUserIdRef.current = user.id;
    taxDirtyRef.current = false;
    payoutEmailDirtyRef.current = false;
    locationDirtyRef.current = false;

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
    if (taxDirtyRef.current) return;
    setTaxRateInput(formatPercent(defaultTaxRate));
  }, [defaultTaxRate]);

  useEffect(() => {
    if (payoutEmailDirtyRef.current) return;
    setPayoutEmailInput(payoutEmail);
  }, [payoutEmail]);

  const setTaxRateInputTracked = useCallback((text: string) => {
    taxDirtyRef.current = true;
    setTaxRateInput(text);
  }, []);

  const setPayoutEmailInputTracked = useCallback((text: string) => {
    payoutEmailDirtyRef.current = true;
    setPayoutEmailInput(text);
  }, []);

  const setLocationPreferenceTracked = useCallback((text: string) => {
    locationDirtyRef.current = true;
    setLocationPreference(text);
  }, []);

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
      taxDirtyRef.current = false;
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
      payoutEmailDirtyRef.current = false;
    } catch (e) {
      console.error('[settings] failed to save payout email', e);
      Alert.alert(
        'Save failed',
        'Unable to save your e-transfer email. Please try again.'
      );
    }
  }, [payoutEmailInput, persistToFirestore, setPayoutEmail]);

  const saveLocationPreference = useCallback(async () => {
    const trimmed = locationPreference.trim();
    try {
      await persistToFirestore({ locationPreference: trimmed });
      locationDirtyRef.current = false;
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
    bankPreference,
    dietaryPreferenceIds,
    handleBankPreferenceChange,
    handleDietaryChange,
    handleTipPercentChange,
    locationPreference,
    payoutEmailError,
    payoutEmailInput,
    saveLocationPreference,
    savePayoutEmail,
    saveTaxRate,
    setLocationPreference: setLocationPreferenceTracked,
    setPayoutEmailError,
    setPayoutEmailInput: setPayoutEmailInputTracked,
    setTaxRateInput: setTaxRateInputTracked,
    setTaxRateError,
    taxRateError,
    taxRateInput,
    tipSelectPercent,
  } as const;
}
