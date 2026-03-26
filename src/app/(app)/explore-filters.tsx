import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, Input } from '@/components/ui';

import type { SectionFilter } from './explore-types';

export type CategoryFilter =
  | 'all'
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'movie_theater';

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'cafe', label: 'Cafes' },
  { key: 'bar', label: 'Bars' },
  { key: 'movie_theater', label: 'Entertainment' },
];

const SECTION_FILTERS: { key: SectionFilter; label: string }[] = [
  { key: 'all', label: 'Browse' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'recommended', label: 'Recommended' },
  { key: 'nearby', label: 'Nearby' },
];

type Props = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sectionFilter: SectionFilter;
  onSectionFilterChange: (f: SectionFilter) => void;
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (f: CategoryFilter) => void;
};

export function ExploreFilters({
  searchQuery,
  onSearchChange,
  sectionFilter,
  onSectionFilterChange,
  categoryFilter,
  onCategoryFilterChange,
}: Props): React.ReactElement {
  return (
    <View className="border-b border-neutral-800 px-4 pb-3 pt-2">
      <Input
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder="Search restaurants, cafes..."
        placeholderTextColor={colors.neutral[400]}
        style={{ color: colors.white, borderColor: colors.neutral[600] }}
        containerClassName="mb-0"
        inputClassName="dark:text-white"
      />
      <View className="mt-4">
        <Text
          className="mb-2 text-xs font-medium uppercase tracking-wide"
          style={{ color: colors.text[800] }}
        >
          View
        </Text>
        <View
          className="flex-row rounded-xl p-1"
          style={{ backgroundColor: colors.neutral[800] }}
        >
          {SECTION_FILTERS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => onSectionFilterChange(key)}
              className="flex-1 items-center rounded-lg py-2.5"
              style={{
                backgroundColor:
                  sectionFilter === key ? colors.accent[200] : 'transparent',
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: sectionFilter === key }}
            >
              <Text
                className="text-sm font-medium"
                style={{
                  color:
                    sectionFilter === key
                      ? colors.accent[100]
                      : colors.text[800],
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View className="mt-4">
        <Text
          className="mb-2 text-xs font-medium uppercase tracking-wide"
          style={{ color: colors.text[800] }}
        >
          Type
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
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
      </View>
    </View>
  );
}
