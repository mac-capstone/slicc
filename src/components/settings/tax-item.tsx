import React, { useEffect, useState } from 'react';
import { Alert, TextInput } from 'react-native';

import { useUser } from '@/api/people/use-users';
import { updateDefaultRatesInFirestore } from '@/api/people/user-api';
import { InlineSelectRow } from '@/components/settings/inline-select-row';
import { Pressable, Text, View } from '@/components/ui';
import { useAuth, useDefaultTaxRate } from '@/lib';
import { useUserSettings } from '@/lib/hooks/use-user-settings';
import {
  resolveDefaultTaxRate,
  resolveDefaultTipRate,
} from '@/lib/resolve-user-default-rates';
import {
  isTipPercentOption,
  normalizeStoredTipPercent,
  TIP_PERCENT_SELECT_OPTIONS,
} from '@/lib/tip-percent-options';
import { type UserIdT } from '@/types';

/** Strips anything that isn't a digit or decimal point, and prevents multiple decimals. */
const sanitizeNumeric = (text: string): string => {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

type RateRowProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onPress: () => void;
  isEditing: boolean;
  displayValue: string;
};

function RateRow({
  label,
  value,
  onChangeText,
  onSave,
  onCancel,
  onPress,
  isEditing,
  displayValue,
}: RateRowProps) {
  return (
    <Pressable
      onPress={!isEditing ? onPress : undefined}
      pointerEvents={isEditing ? 'box-none' : 'auto'}
      className="h-10 flex-row items-center justify-between px-4"
    >
      <Text className="text-text-50">{label}</Text>
      {isEditing ? (
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center rounded-lg bg-neutral-100 px-2 dark:bg-neutral-700">
            <TextInput
              value={value}
              onChangeText={(text) => onChangeText(sanitizeNumeric(text))}
              keyboardType="numeric"
              placeholder="0"
              autoFocus
              className="w-12 py-0.5 text-right text-sm text-black dark:text-white"
              placeholderTextColor="#999"
              onSubmitEditing={onSave}
              returnKeyType="done"
            />
            <Text className="ml-1 text-sm text-text-50">%</Text>
          </View>
          <Pressable onPress={onSave}>
            <Text className="text-sm font-bold text-accent-100">Save</Text>
          </Pressable>
          <Pressable onPress={onCancel}>
            <Text className="text-sm text-neutral-400">Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Text className="text-text-50">{displayValue}</Text>
      )}
    </Pressable>
  );
}

export const TaxItem = () => {
  const userId = useAuth.use.userId();
  const { data: user } = useUser({
    variables: userId as UserIdT,
    enabled: Boolean(userId),
  });
  const { defaultTaxRate: mmkvTaxRate, setDefaultTaxRate: setMmkvTaxRate } =
    useDefaultTaxRate();

  const { defaultTipPercent: mmkvTipRate } = useUserSettings();
  const resolvedTaxRate = resolveDefaultTaxRate(user, mmkvTaxRate);
  const resolvedTipRate = resolveDefaultTipRate(user, mmkvTipRate);

  const [taxInput, setTaxInput] = useState(
    resolvedTaxRate > 0 ? resolvedTaxRate.toString() : ''
  );
  const [editingTax, setEditingTax] = useState(false);

  // Sync inputs when Firestore data arrives
  useEffect(() => {
    if (!editingTax) {
      setTaxInput(resolvedTaxRate > 0 ? resolvedTaxRate.toString() : '');
    }
  }, [resolvedTaxRate, editingTax]);

  const handleSaveTax = async () => {
    const raw = taxInput.trim();
    const parsed = raw === '' ? 0 : parseFloat(raw);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      Alert.alert(
        'Invalid Tax Rate',
        'Please enter a value between 0 and 100.'
      );
      return;
    }
    setMmkvTaxRate(parsed);
    if (userId) {
      try {
        await updateDefaultRatesInFirestore(userId, {
          defaultTaxRate: parsed,
        });
      } catch (e) {
        console.error('[tax-item] failed to save tax rate', e);
      }
    }
    setEditingTax(false);
  };

  const handleTipSelect = async (raw: string | number) => {
    const parsed = Number.parseInt(String(raw), 10);
    if (!userId || !isTipPercentOption(parsed)) return;
    try {
      await updateDefaultRatesInFirestore(userId, {
        defaultTipRate: parsed,
      });
    } catch (e) {
      console.error('[tax-item] failed to save tip rate', e);
    }
  };

  return (
    <>
      <RateRow
        label="Default Tax Rate"
        value={taxInput}
        onChangeText={setTaxInput}
        onSave={handleSaveTax}
        onCancel={() => setEditingTax(false)}
        onPress={() => {
          setTaxInput(resolvedTaxRate > 0 ? resolvedTaxRate.toString() : '');
          setEditingTax(true);
        }}
        isEditing={editingTax}
        displayValue={resolvedTaxRate > 0 ? `${resolvedTaxRate}%` : 'Not set'}
      />
      <View className="px-4">
        <InlineSelectRow
          label="Default Tip Rate"
          value={String(normalizeStoredTipPercent(resolvedTipRate))}
          options={[...TIP_PERCENT_SELECT_OPTIONS]}
          onSelect={(v) => void handleTipSelect(v)}
        />
      </View>
    </>
  );
};
