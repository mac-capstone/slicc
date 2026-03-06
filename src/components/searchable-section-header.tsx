import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Keyboard, Pressable, View } from 'react-native';

import { colors, Input, Text } from '@/components/ui';

type Props = {
  title: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  isSearchInputVisible: boolean;
  onSearchInputVisibleChange: (visible: boolean) => void;
  placeholder?: string;
  searchLabel?: string;
  clearSearchLabel?: string;
};

export function SearchableSectionHeader({
  title,
  searchQuery,
  onSearchQueryChange,
  isSearchInputVisible,
  onSearchInputVisibleChange,
  placeholder = 'Search...',
  searchLabel = 'Search',
  clearSearchLabel = 'Clear search',
}: Props) {
  const showClearButton = isSearchInputVisible || searchQuery.length > 0;

  const handleClear = () => {
    onSearchQueryChange('');
    onSearchInputVisibleChange(false);
    Keyboard.dismiss();
  };

  const handleSearchPress = () => onSearchInputVisibleChange(true);

  const displayTitle = searchQuery.trim() ? `"${searchQuery.trim()}"` : title;

  return (
    <View className="h-14 flex-row items-center overflow-hidden">
      <View className="flex-1" />
      <View className="min-w-0 flex-[2] items-center justify-center self-stretch px-2">
        {isSearchInputVisible ? (
          <Input
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            onBlur={() => onSearchInputVisibleChange(false)}
            placeholder={placeholder}
            autoFocus
            style={{
              color: colors.white,
              borderColor: colors.neutral[600],
              fontSize: 18,
            }}
            containerClassName="w-full mb-0"
            inputClassName="min-h-[36px] border py-1 text-center text-2xl font-interSemiBold dark:text-white"
            raw
          />
        ) : (
          <Text
            className="font-interSemiBold text-center text-2xl"
            style={{ color: colors.text[800] }}
          >
            {displayTitle}
          </Text>
        )}
      </View>
      <View className="flex-1 flex-row justify-end">
        <Pressable
          onPress={showClearButton ? handleClear : handleSearchPress}
          className="p-2"
          accessibilityLabel={showClearButton ? clearSearchLabel : searchLabel}
          accessibilityRole="button"
        >
          {showClearButton ? (
            <Feather name="x" size={20} color={colors.text[800]} />
          ) : (
            <Feather name="search" size={20} color={colors.text[800]} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
