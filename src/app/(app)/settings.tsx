import { Env } from '@env';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useUser } from '@/api/people/use-users';
import { updateUserSettingsInFirestore } from '@/api/people/user-api';
import { DietaryPreferencesMultiSelect } from '@/components/settings/dietary-preferences-multi-select';
import { LanguageItem } from '@/components/settings/language-item';
import { ThemeItem } from '@/components/settings/theme-item';
import {
  Button,
  FocusAwareStatusBar,
  Input,
  SafeAreaView,
  ScrollView,
  Select,
  Text,
  View,
} from '@/components/ui';
import {
  normalizeDietaryPreferenceIds,
  VALID_DIETARY_IDS,
} from '@/lib/dietary-preference-options';
import { translate, useAuth, useUserSettings } from '@/lib';
import { BANK_OPTIONS, isBankPreference } from '@/lib/payment-utils';
import { type BankPreference } from '@/types';

function mapFirestoreDietaryToIds(prefs: string[]): string[] {
  const hyphenMap: Record<string, string> = {
    'gluten-free': 'gluten_free',
    'dairy-free': 'dairy_free',
    'nut-free': 'nut_free',
  };
  const out: string[] = [];
  for (const raw of prefs) {
    const t = raw.trim().toLowerCase();
    if (!t || t === 'none') continue;
    const mapped = hyphenMap[t] ?? t.replace(/-/g, '_');
    if (VALID_DIETARY_IDS.has(mapped)) out.push(mapped);
  }
  return normalizeDietaryPreferenceIds(out);
}

const sanitizeNumeric = (text: string): string => {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');

  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
  }

  return cleaned;
};

const formatPercent = (value: number): string => {
  if (value === 0) return '0';
  return Number.isInteger(value) ? value.toString() : value.toString();
};

const validatePercent = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return 'Enter a value between 0 and 100.';
  }

  return null;
};

const validateEmail = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return isValid ? null : 'Enter a valid email address.';
};

const normalizeTextValue = (value: string): string => value.trim();

const formatAppName = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

function SectionTitle({ tx }: { tx: Parameters<typeof translate>[0] }) {
  return (
    <Text
      tx={tx}
      className="text-xs uppercase tracking-widest text-charcoal-400"
    />
  );
}

function SectionDivider() {
  return <View className="mt-8 border-b border-charcoal-800" />;
}

function InlinePercentRow({
  labelTx,
  value,
  onChangeText,
  onSubmit,
  error,
  testID,
}: {
  labelTx: Parameters<typeof translate>[0];
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  error?: string | null;
  testID: string;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between gap-4">
        <Text tx={labelTx} className="shrink text-base text-text-50" />
        <Input
          testID={testID}
          compact
          keyboardType="decimal-pad"
          returnKeyType="done"
          value={value}
          onChangeText={(text) => onChangeText(sanitizeNumeric(text))}
          onBlur={onSubmit}
          onSubmitEditing={onSubmit}
          placeholder="0"
          containerClassName="mb-0 w-24 shrink-0"
          inputClassName="border-charcoal-500 bg-charcoal-900 font-futuraDemi text-right text-lg text-text-50"
          style={{ textAlign: 'right' }}
        />
      </View>
      {error ? (
        <Text className="mt-2 text-sm text-danger-400">{error}</Text>
      ) : null}
    </View>
  );
}

export default function Settings() {
  const signOut = useAuth.use.signOut();
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
  const [tipInput, setTipInput] = useState(
    formatPercent(defaultTipPercent)
  );
  const [payoutEmailInput, setPayoutEmailInput] = useState(payoutEmail);
  const [bankInstructionsInput, setBankInstructionsInput] = useState(
    bankPayoutInstructions
  );
  const [locationPreference, setLocationPreference] = useState('');
  const [bankPreference, setBankPreference] = useState<BankPreference>('none');
  const [taxRateError, setTaxRateError] = useState<string | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const [payoutEmailError, setPayoutEmailError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!user) return;
    if (user.defaultTaxRate !== undefined) {
      setDefaultTaxRate(user.defaultTaxRate);
    }
    if (user.defaultTipRate !== undefined) {
      setDefaultTipPercent(user.defaultTipRate);
    }
    setDietaryPreferenceIds(
      mapFirestoreDietaryToIds(user.dietaryPreferences ?? [])
    );
    setLocationPreference(user.locationPreference ?? '');
    setPayoutEmail(user.eTransferEmail ?? '');
    setBankPreference(user.bankPreference ?? 'none');
  }, [user, setBankPreference, setDefaultTaxRate, setDefaultTipPercent, setDietaryPreferenceIds, setPayoutEmail]);

  useEffect(() => {
    setTaxRateInput(formatPercent(defaultTaxRate));
  }, [defaultTaxRate]);

  useEffect(() => {
    setTipInput(formatPercent(defaultTipPercent));
  }, [defaultTipPercent]);

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

  const saveTipPercent = useCallback(async () => {
    const error = validatePercent(tipInput);
    if (error) {
      setTipError(error);
      return;
    }

    const parsed = tipInput.trim() === '' ? 0 : Number.parseFloat(tipInput);
    setDefaultTipPercent(parsed);
    setTipInput(formatPercent(parsed));
    setTipError(null);

    try {
      await persistToFirestore({ defaultTipRate: parsed });
    } catch (e) {
      console.error('[settings] failed to save tip percent', e);
      Alert.alert(
        'Save failed',
        'Unable to save your default tip. Please try again.'
      );
    }
  }, [persistToFirestore, setDefaultTipPercent, tipInput]);

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

  return (
    <>
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <SafeAreaView className="flex-1 bg-background-950" edges={['top']}>
        <ScrollView
          className="flex-1 bg-background-950"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View className="px-6 pb-8 pt-2">
            <Text
              tx="settings.title"
              className="font-futuraBold text-5xl text-text-50"
            />

            <View className="mt-10">
              <SectionTitle tx="settings.generale" />
              <View className="mt-5 overflow-hidden rounded-xl bg-charcoal-900">
                <LanguageItem />
                <View className="mx-4 h-px bg-charcoal-800" />
                <ThemeItem />
              </View>
            </View>

            <SectionDivider />

            <View className="mt-8">
              <SectionTitle tx="settings.expense_defaults" />
              <View className="mt-6 gap-5">
                <InlinePercentRow
                  labelTx="settings.tax_rate_short"
                  value={taxRateInput}
                  onChangeText={(text) => {
                    setTaxRateInput(text);
                    setTaxRateError(null);
                  }}
                  onSubmit={() => {
                    void saveTaxRate();
                  }}
                  error={taxRateError}
                  testID="settings-tax-rate-input"
                />
                <InlinePercentRow
                  labelTx="settings.tip"
                  value={tipInput}
                  onChangeText={(text) => {
                    setTipInput(text);
                    setTipError(null);
                  }}
                  onSubmit={() => {
                    void saveTipPercent();
                  }}
                  error={tipError}
                  testID="settings-tip-input"
                />
              </View>
            </View>

            <SectionDivider />

            <View className="mt-8">
              <SectionTitle tx="settings.dietary_preferences" />
              <DietaryPreferencesMultiSelect
                value={dietaryPreferenceIds}
                onChange={(ids) => {
                  void handleDietaryChange(ids);
                }}
                testID="settings-dietary"
              />
            </View>

            <SectionDivider />

            <View className="mt-8">
              <SectionTitle tx="settings.preferred_location" />
              <Input
                testID="settings-location-input"
                placeholder={translate(
                  'settings.location_preference_placeholder'
                )}
                value={locationPreference}
                onChangeText={setLocationPreference}
                onBlur={() => {
                  void saveLocationPreference();
                }}
                containerClassName="mb-0 mt-5"
                inputClassName="rounded-xl border-0 bg-charcoal-900 px-4 py-4 text-base text-text-50"
              />
            </View>

            <SectionDivider />

            <View className="mt-8">
              <SectionTitle tx="settings.payout_details" />
              <Input
                testID="settings-payout-email-input"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={translate('settings.payout_email')}
                value={payoutEmailInput}
                onChangeText={(text) => {
                  setPayoutEmailInput(text);
                  setPayoutEmailError(null);
                }}
                onBlur={() => {
                  void savePayoutEmail();
                }}
                error={payoutEmailError ?? undefined}
                containerClassName="mb-0 mt-5"
                inputClassName="rounded-xl border-0 bg-charcoal-900 px-4 py-4 text-base text-text-50"
              />
              <View className="mt-4 rounded-xl bg-charcoal-900 px-4 py-3">
                <Select
                  label={translate('settings.preferred_bank')}
                  value={bankPreference}
                  options={[...BANK_OPTIONS]}
                  onSelect={(value) => {
                    void handleBankPreferenceChange(
                      typeof value === 'string' ? value : ''
                    );
                  }}
                />
              </View>
              <Input
                testID="settings-bank-instructions-input"
                multiline
                maxLength={240}
                textAlignVertical="top"
                placeholder={translate(
                  'settings.bank_instructions_placeholder'
                )}
                value={bankInstructionsInput}
                onChangeText={setBankInstructionsInput}
                onBlur={saveBankInstructions}
                containerClassName="mb-0 mt-4"
                inputClassName="min-h-32 rounded-xl border-0 bg-charcoal-900 px-4 py-4 text-base leading-6 text-text-50"
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            <SectionDivider />

            <View className="mt-8">
              <SectionTitle tx="settings.about" />
              <Text className="mt-5 text-xl text-text-50">
                {`${formatAppName(Env.NAME)} v${Env.VERSION}`}
              </Text>
            </View>

            <View className="mt-10">
              <Button
                label={translate('settings.logout')}
                variant="outline"
                size="lg"
                onPress={signOut}
                className="rounded-full border border-charcoal-500 bg-background-950 dark:border-charcoal-500"
                textClassName="font-futuraDemi text-base text-text-50"
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
