import Octicons from '@expo/vector-icons/Octicons';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, Input } from '@/components/ui';

export type CategoryFilter =
  | 'all'
  | 'restaurant'
  | 'cafe'
  | 'entertainment'
  | 'sports';

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'cafe', label: 'Cafe' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'sports', label: 'Sports' },
];

type Props = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (f: CategoryFilter) => void;
  showMap: boolean;
  onToggleMap: () => void;
  hasLocation: boolean;
};

export function ExploreFilters({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  showMap,
  onToggleMap,
  hasLocation,
}: Props): React.ReactElement {
  return (
    <View className="border-b border-neutral-800 px-4 pb-3 pt-2">
      <Input
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder="Search places..."
        placeholderTextColor={colors.neutral[400]}
        style={{ color: colors.white, borderColor: colors.neutral[600] }}
        containerClassName="mb-0"
        inputClassName="dark:text-white"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        className="mt-3"
      >
        {CATEGORY_FILTERS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => onCategoryFilterChange(key)}
            className="rounded-full px-4 py-2"
            style={{
              backgroundColor:
                categoryFilter === key
                  ? colors.accent[200]
                  : colors.neutral[800],
              borderWidth: categoryFilter === key ? 0 : 1,
              borderColor: colors.neutral[700],
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: categoryFilter === key }}
          >
            <Text
              className="text-sm font-medium"
              style={{
                color:
                  categoryFilter === key
                    ? colors.accent[100]
                    : colors.text[800],
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        onPress={hasLocation ? onToggleMap : undefined}
        disabled={!hasLocation}
        className="mt-3 flex-row items-center gap-2"
        accessibilityRole="button"
        accessibilityLabel={
          hasLocation
            ? showMap
              ? 'Show list'
              : 'Show nearby map'
            : 'Location unavailable'
        }
      >
        <Octicons
          name="location"
          size={16}
          color={hasLocation ? colors.accent[100] : colors.text[800]}
        />
        <Text
          className="text-sm font-medium"
          style={{
            color: hasLocation ? colors.accent[100] : colors.text[800],
          }}
        >
          {hasLocation
            ? showMap
              ? 'Show List'
              : 'Show Nearby Map'
            : 'Location unavailable'}
        </Text>
      </Pressable>
    </View>
  );
}
