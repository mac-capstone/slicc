import React, { useState } from 'react';
import { Alert, TextInput } from 'react-native';

import { Pressable, Text, View } from '@/components/ui';
import { useDefaultTaxRate } from '@/lib';

/** Strips anything that isn't a digit or decimal point, and prevents multiple decimals. */
const sanitizeNumeric = (text: string): string => {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

export const TaxItem = () => {
  const { defaultTaxRate, setDefaultTaxRate } = useDefaultTaxRate();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(defaultTaxRate.toString());

  const handleSave = () => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      Alert.alert(
        'Invalid Tax Rate',
        'Please enter a value between 0 and 100.'
      );
      return;
    }
    setDefaultTaxRate(parsed);
    setIsEditing(false);
  };

  const handlePress = () => {
    setInputValue(defaultTaxRate === 0 ? '' : defaultTaxRate.toString());
    setIsEditing(true);
  };

  return (
    <Pressable
      onPress={!isEditing ? handlePress : undefined}
      pointerEvents={isEditing ? 'box-none' : 'auto'}
      className="h-10 flex-row items-center justify-between px-4"
    >
      <Text className="text-text-50">Default Tax Rate</Text>
      {isEditing ? (
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center rounded-lg bg-neutral-100 px-2 dark:bg-neutral-700">
            <TextInput
              value={inputValue}
              onChangeText={(text) => setInputValue(sanitizeNumeric(text))}
              keyboardType="numeric"
              placeholder="0"
              autoFocus
              className="w-12 py-0.5 text-right text-sm text-black dark:text-white"
              placeholderTextColor="#999"
              onSubmitEditing={handleSave}
              returnKeyType="done"
            />
            <Text className="ml-1 text-sm text-text-50">%</Text>
          </View>
          <Pressable onPress={handleSave}>
            <Text className="text-sm font-bold text-accent-100">Save</Text>
          </Pressable>
          <Pressable onPress={() => setIsEditing(false)}>
            <Text className="text-sm text-neutral-400">Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Text className="text-text-50">
          {defaultTaxRate > 0 ? `${defaultTaxRate}%` : 'Not set'}
        </Text>
      )}
    </Pressable>
  );
};
