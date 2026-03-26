import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  SectionList,
  Text,
  View,
} from 'react-native';

import type { Place } from '@/api/places/places-api';
import { PlacesMap } from '@/components/places-map';
import { colors } from '@/components/ui';

import { ExploreEmptyMessage } from './explore-empty-message';
import { PlaceListItem } from './explore-place-list-item';
import type { SectionFilter } from './explore-types';

const LOADING_PLACEHOLDER_ID = '__loading__';

export type ExploreSection = {
  id: string;
  title: string;
  data: (Place | { id: string })[];
  isLoading?: boolean;
};

type Props = {
  sectionFilter: SectionFilter;
  hasContent: boolean;
  currentPlaces: Place[];
  showSearchView: boolean;
  searchViewLoading: boolean;
  searchViewEmpty: boolean;
  searchViewData: Place[] | null;
  searchQuery: string;
  sections: ExploreSection[];
  initialLoad: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  hasApiKey: boolean;
  isApiKeyError: boolean;
  hasLocation: boolean;
  hasLikes: boolean;
  isSearching: boolean;
  locationStatus: string | null;
  onPlacePress: (place: Place) => void;
};

export function ExploreContent({
  sectionFilter,
  hasContent: _hasContent,
  currentPlaces,
  showSearchView,
  searchViewLoading,
  searchViewEmpty,
  searchViewData,
  searchQuery,
  sections,
  initialLoad,
  userLocation,
  hasApiKey,
  isApiKeyError,
  hasLocation,
  hasLikes,
  isSearching,
  locationStatus,
  onPlacePress,
}: Props): React.ReactElement {
  const emptyMessageProps = {
    hasApiKey,
    isApiKeyError,
    sectionFilter,
    hasLocation,
    hasLikes,
    isSearching,
    locationStatus,
  };

  if (sectionFilter === 'nearby' && hasLocation) {
    return (
      <PlacesMap
        places={currentPlaces}
        userLocation={userLocation}
        onPlacePress={onPlacePress}
      />
    );
  }

  if (showSearchView) {
    if (searchViewLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      );
    }
    if (searchViewEmpty) {
      return (
        <View className="flex-1 items-center justify-center px-6">
          <ExploreEmptyMessage {...emptyMessageProps} />
        </View>
      );
    }
    return (
      <FlatList
        data={searchViewData ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 32,
        }}
        ListHeaderComponent={
          <Text
            className="mb-4 font-futuraDemi text-base"
            style={{ color: colors.text[800] }}
          >
            Results for &quot;{searchQuery.trim()}&quot;
          </Text>
        }
        renderItem={({ item }) => (
          <PlaceListItem
            item={item}
            userLocation={userLocation}
            onPress={onPlacePress}
          />
        )}
      />
    );
  }

  if (initialLoad) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <ExploreEmptyMessage {...emptyMessageProps} />
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 32,
      }}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={() => null}
      renderItem={({ item }) =>
        item.id.startsWith(LOADING_PLACEHOLDER_ID) ? (
          <View className="mb-4 items-center py-8">
            <ActivityIndicator />
          </View>
        ) : (
          <PlaceListItem
            item={item as Place}
            userLocation={userLocation}
            onPress={onPlacePress}
          />
        )
      }
      ListEmptyComponent={
        sections.every((s) => s.data.length === 0) &&
        !sections.some((s) => s.isLoading) ? (
          <View className="items-center justify-center py-12">
            <ExploreEmptyMessage {...emptyMessageProps} />
          </View>
        ) : null
      }
    />
  );
}
