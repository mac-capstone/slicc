import { Env } from '@env';

import { BankPreferenceSelect } from '@/components/settings/bank-preference-select';
import { DietaryPreferencesMultiSelect } from '@/components/settings/dietary-preferences-multi-select';
import { InlineSelectRow } from '@/components/settings/inline-select-row';
import { LanguageItem } from '@/components/settings/language-item';
import {
  InlinePercentRow,
  SectionDivider,
  SectionTitle,
} from '@/components/settings/settings-screen-shared';
import { ThemeItem } from '@/components/settings/theme-item';
import { Button, Input, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { formatAppName } from '@/lib/settings-screen-helpers';
import { TIP_PERCENT_SELECT_OPTIONS } from '@/lib/tip-percent-options';
import { type BankPreference } from '@/types';

export type SettingsScreenContentProps = {
  bankPreference: BankPreference;
  dietaryPreferenceIds: readonly string[];
  handleBankPreferenceChange: (value: string) => void;
  handleDietaryChange: (ids: string[]) => void;
  handleTipPercentChange: (value: string | number) => void | Promise<void>;
  locationPreference: string;
  payoutEmailError: string | null;
  payoutEmailInput: string;
  saveLocationPreference: () => void | Promise<void>;
  savePayoutEmail: () => void | Promise<void>;
  saveTaxRate: () => void | Promise<void>;
  setLocationPreference: (value: string) => void;
  setPayoutEmailError: (value: string | null) => void;
  setPayoutEmailInput: (value: string) => void;
  setTaxRateInput: (value: string) => void;
  setTaxRateError: (value: string | null) => void;
  signOut: () => void;
  taxRateError: string | null;
  taxRateInput: string;
  tipSelectPercent: number;
};

export function SettingsScreenContent({
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
  setLocationPreference,
  setPayoutEmailError,
  setPayoutEmailInput,
  setTaxRateInput,
  setTaxRateError,
  signOut,
  taxRateError,
  taxRateInput,
  tipSelectPercent,
}: SettingsScreenContentProps) {
  return (
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
          <InlineSelectRow
            labelTx="settings.tip"
            value={String(tipSelectPercent)}
            options={[...TIP_PERCENT_SELECT_OPTIONS]}
            onSelect={(value) => {
              void handleTipPercentChange(value);
            }}
            testID="settings-tip-select"
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
          placeholder={translate('settings.location_preference_placeholder')}
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
        <BankPreferenceSelect
          value={bankPreference}
          onSelect={(v) => {
            void handleBankPreferenceChange(v);
          }}
          testID="settings-bank"
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
          className="rounded-full border border-danger-500 bg-background-950 dark:border-danger-500"
          textClassName="font-futuraDemi text-base text-text-50"
        />
      </View>
    </View>
  );
}
