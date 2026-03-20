import { Env } from '@env';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useUser } from '@/api/people/use-users';
import { updateUserSettingsInFirestore } from '@/api/people/user-api';
import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { LanguageItem } from '@/components/settings/language-item';
import { TaxItem } from '@/components/settings/tax-item';
import { ThemeItem } from '@/components/settings/theme-item';
import {
  Button,
  FocusAwareStatusBar,
  Input,
  ScrollView,
  Select,
  Text,
  View,
} from '@/components/ui';
import { useAuth } from '@/lib';
import { BANK_OPTIONS, isBankPreference } from '@/lib/payment-utils';
import { type BankPreference } from '@/types';

const DIETARY_OPTIONS = [
  { label: 'None selected', value: 'none' },
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Halal', value: 'halal' },
  { label: 'Kosher', value: 'kosher' },
  { label: 'Gluten-free', value: 'gluten-free' },
  { label: 'Dairy-free', value: 'dairy-free' },
  { label: 'Nut-free', value: 'nut-free' },
  { label: 'Other', value: 'other' },
] as const;

type DietaryOptionValue = (typeof DIETARY_OPTIONS)[number]['value'];

function isDietaryOption(value: string): value is DietaryOptionValue {
  return DIETARY_OPTIONS.some((option) => option.value === value);
}

export default function Settings() {
  const signOut = useAuth.use.signOut();
  const userId = useAuth.use.userId();
  const queryClient = useQueryClient();

  const { data: user } = useUser({
    variables: userId ?? undefined,
    enabled: Boolean(userId),
  });

  const [dietarySelection, setDietarySelection] =
    useState<DietaryOptionValue>('none');
  const [dietaryOtherText, setDietaryOtherText] = useState('');
  const [remainingDietaryPreferences, setRemainingDietaryPreferences] =
    useState<string[]>([]);
  const [locationPreference, setLocationPreference] = useState('');
  const [eTransferEmail, setETransferEmail] = useState('');
  const [bankPreference, setBankPreference] = useState<BankPreference>('none');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const allDietaryPreferences = Array.isArray(user.dietaryPreferences)
      ? user.dietaryPreferences.filter(
          (preference): preference is string => typeof preference === 'string'
        )
      : [];
    const [firstDietaryRaw = '', ...restDietary] = allDietaryPreferences;
    const firstDietary = firstDietaryRaw.trim().toLowerCase();

    if (firstDietary && isDietaryOption(firstDietary)) {
      setDietarySelection(firstDietary);
      setDietaryOtherText('');
    } else if (firstDietary) {
      setDietarySelection('other');
      setDietaryOtherText(firstDietaryRaw);
    } else {
      setDietarySelection('none');
      setDietaryOtherText('');
    }
    setRemainingDietaryPreferences(restDietary);
    setLocationPreference(user.locationPreference ?? '');
    setETransferEmail(user.eTransferEmail ?? '');
    setBankPreference(user.bankPreference ?? 'none');
  }, [user]);

  const parsedDietaryPreferences = useMemo(() => {
    if (dietarySelection === 'none') return [...remainingDietaryPreferences];
    if (dietarySelection === 'other') {
      const trimmed = dietaryOtherText.trim();
      return trimmed.length > 0
        ? [trimmed, ...remainingDietaryPreferences]
        : [...remainingDietaryPreferences];
    }
    return [dietarySelection, ...remainingDietaryPreferences];
  }, [dietaryOtherText, dietarySelection, remainingDietaryPreferences]);

  const handleSavePreferences = async () => {
    if (!userId) {
      Alert.alert('Not signed in', 'Please sign in to save your settings.');
      return;
    }

    const trimmedEtransferEmail = eTransferEmail.trim();
    const isEmailValid =
      trimmedEtransferEmail.length === 0 ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEtransferEmail);

    if (!isEmailValid) {
      Alert.alert('Invalid email', 'Please enter a valid e-transfer email.');
      return;
    }

    setSaving(true);
    try {
      await updateUserSettingsInFirestore(userId, {
        dietaryPreferences: parsedDietaryPreferences,
        locationPreference: locationPreference.trim(),
        eTransferEmail: trimmedEtransferEmail,
        bankPreference,
      });

      await queryClient.invalidateQueries({
        queryKey: ['users', 'userId', userId],
      });
      Alert.alert('Saved', 'Your preferences have been updated.');
    } catch (error) {
      console.error('[settings] failed to save user preferences', error);
      Alert.alert(
        'Save failed',
        'Unable to save preferences right now. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView>
        <View className="flex-1 px-4">
          <ItemsContainer title="settings.generale">
            <LanguageItem />
            <ThemeItem />
            <TaxItem />
          </ItemsContainer>

          <Text className="pb-2 pt-4 text-lg text-text-50">
            Your Preferences
          </Text>
          <ItemsContainer>
            <View className="px-4 py-3">
              <Select
                label="Dietary restrictions"
                value={dietarySelection}
                options={[...DIETARY_OPTIONS]}
                onSelect={(value) => {
                  if (typeof value === 'string' && isDietaryOption(value)) {
                    setDietarySelection(value);
                  }
                }}
              />
              {dietarySelection === 'other' && (
                <Input
                  label="Other dietary restriction"
                  value={dietaryOtherText}
                  onChangeText={setDietaryOtherText}
                  placeholder="Type your dietary restriction"
                />
              )}
              <Input
                label="Preferred location"
                value={locationPreference}
                onChangeText={setLocationPreference}
                placeholder="Downtown, near transit"
              />
            </View>
          </ItemsContainer>

          <Text className="pb-2 pt-4 text-lg text-text-50">Payout Details</Text>
          <ItemsContainer>
            <View className="px-4 py-3">
              <Input
                label="e-Transfer email"
                value={eTransferEmail}
                onChangeText={setETransferEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
              <Select
                label="Preferred bank"
                value={bankPreference}
                options={BANK_OPTIONS}
                onSelect={(value) => {
                  if (typeof value === 'string' && isBankPreference(value)) {
                    setBankPreference(value);
                  }
                }}
              />
            </View>
          </ItemsContainer>

          <View className="mt-3">
            <Button
              label={saving ? 'Saving...' : 'Save preferences'}
              onPress={handleSavePreferences}
              disabled={saving}
            />
          </View>

          <ItemsContainer title="settings.about">
            <Item text="settings.app_name" value={Env.NAME} />
            <Item text="settings.version" value={Env.VERSION} />
          </ItemsContainer>

          <ItemsContainer title="settings.support_us">
            <Item text="settings.share" onPress={() => {}} />
            <Item text="settings.rate" onPress={() => {}} />
            <Item text="settings.support" onPress={() => {}} />
          </ItemsContainer>

          <ItemsContainer title="settings.links">
            <Item text="settings.privacy" onPress={() => {}} />
            <Item text="settings.terms" onPress={() => {}} />
          </ItemsContainer>

          <View className="my-8">
            <ItemsContainer>
              <Item text="settings.logout" onPress={signOut} />
            </ItemsContainer>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
