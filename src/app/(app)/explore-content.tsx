import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Place } from '@/api/places/places-api';
import { PlacesMap, type PlacesMapHandle } from '@/components/places-map';
import { colors } from '@/components/ui';

import { ExploreEmptyMessage } from './explore-empty-message';
import { PlaceListItem } from './explore-place-list-item';

type Props = {
  showMap: boolean;
  mapPlaces: Place[];
  showSearchView: boolean;
  searchViewLoading: boolean;
  searchViewEmpty: boolean;
  searchViewData: Place[] | null;
  searchQuery: string;
  browseData: Place[];
  browseLoading: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  hasApiKey: boolean;
  isApiKeyError: boolean;
  hasLocation: boolean;
  hasLikes: boolean;
  isSearching: boolean;
  showMapToggle: boolean;
  locationStatus: string | null;
  onPlacePress: (place: Place) => void;
  mapRefreshKey: number;
  scoreById?: Map<string, number>;
};

const ANIM_CONFIG = { duration: 280, easing: Easing.out(Easing.cubic) };

export function ExploreContent({
  showMap,
  mapPlaces,
  showSearchView,
  searchViewLoading,
  searchViewEmpty,
  searchViewData,
  searchQuery,
  browseData,
  browseLoading,
  userLocation,
  hasApiKey,
  isApiKeyError,
  hasLocation,
  hasLikes,
  isSearching,
  showMapToggle,
  locationStatus,
  onPlacePress,
  mapRefreshKey,
  scoreById,
}: Props): React.ReactElement {
  const emptyMessageProps = {
    hasApiKey,
    isApiKeyError,
    hasLocation,
    hasLikes,
    isSearching,
    showMap: showMapToggle,
    locationStatus,
  };

  const [highlightedPlaceId, setHighlightedPlaceId] = useState<string | null>(
    null
  );
  const listRef = useRef<FlatList<Place>>(null);
  const mapRef = useRef<PlacesMapHandle>(null);
  const isScrollingFromMarker = useRef(false);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (isScrollingFromMarker.current) return;
      const topItem = viewableItems[0];
      if (topItem?.item?.id) {
        setHighlightedPlaceId(topItem.item.id as string);
      }
    },
    []
  );

  const listData = useMemo(
    () => (showSearchView ? (searchViewData ?? []) : mapPlaces),
    [showSearchView, searchViewData, mapPlaces]
  );

  const listDataKey = useMemo(
    () => listData.map((p) => p.id).join(','),
    [listData]
  );

  const mapFlatListExtraData = useMemo(
    () => ({ highlightedPlaceId, scoreById }),
    [highlightedPlaceId, scoreById]
  );

  /** Shared by browse + search lists when `matchScore` comes from `scoreById`. */
  const scoreListExtraData = useMemo(() => ({ scoreById }), [scoreById]);

  useEffect(() => {
    setHighlightedPlaceId(null);
    if (showMap) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [listDataKey, showMap]);

  const handleMarkerPress = useCallback(
    (place: Place) => {
      isScrollingFromMarker.current = true;
      setHighlightedPlaceId(place.id);

      const index = listData.findIndex((p) => p.id === place.id);
      if (index < 0 || !listRef.current) return;

      listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0 });
    },
    [listData]
  );

  const handleScrollBeginDrag = useCallback(() => {
    isScrollingFromMarker.current = false;
    mapRef.current?.fitAllMarkers();
  }, []);

  const mapFlex = useSharedValue(showMap ? 0.7 : 0);

  useEffect(() => {
    mapFlex.value = withTiming(showMap ? 0.7 : 0, ANIM_CONFIG);
  }, [showMap, mapFlex]);

  useEffect(() => {
    if (showMap) {
      const timer = setTimeout(() => mapRef.current?.fitAllMarkers(), 350);
      return () => clearTimeout(timer);
    }
  }, [showMap, listDataKey]);

  const mapAnimStyle = useAnimatedStyle(() => ({
    flex: mapFlex.value,
    opacity: mapFlex.value + 0.3,
    overflow: 'hidden' as const,
  }));

  const renderListContent = (): React.ReactElement => {
    if (showMap) {
      const isListLoading = showSearchView ? searchViewLoading : false;

      if (isListLoading) {
        return (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        );
      }
      if (listData.length === 0) {
        return (
          <View className="flex-1 items-center justify-center px-6">
            <ExploreEmptyMessage {...emptyMessageProps} />
          </View>
        );
      }
      return (
        <FlatList
          ref={listRef}
          data={listData}
          extraData={mapFlatListExtraData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 160,
          }}
          ListFooterComponent={
            <Text
              className="mt-2 pb-2 text-center text-sm"
              style={{ color: colors.text[800] }}
            >
              End of results
            </Text>
          }
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
          renderItem={({ item }) => {
            const activeId = highlightedPlaceId ?? listData[0]?.id ?? null;
            return (
              <PlaceListItem
                item={item}
                userLocation={userLocation}
                onPress={onPlacePress}
                isHighlighted={item.id === activeId}
                matchScore={scoreById?.get(item.id)}
              />
            );
          }}
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
          extraData={scoreListExtraData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 32,
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
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
              matchScore={scoreById?.get(item.id)}
            />
          )}
        />
      );
    }

    if (browseLoading && browseData.length === 0) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      );
    }

    if (browseData.length === 0) {
      return (
        <View className="flex-1 items-center justify-center px-6">
          <ExploreEmptyMessage {...emptyMessageProps} />
        </View>
      );
    }

    return (
      <FlatList
        data={browseData}
        extraData={scoreListExtraData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 32,
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <PlaceListItem
            item={item}
            userLocation={userLocation}
            onPress={onPlacePress}
            matchScore={scoreById?.get(item.id)}
          />
        )}
      />
    );
  };

  return (
    <View className="flex-1">
      {hasLocation && (
        <Animated.View
          style={mapAnimStyle}
          pointerEvents={showMap ? 'auto' : 'none'}
        >
          <PlacesMap
            key={mapRefreshKey}
            ref={mapRef}
            places={listData}
            userLocation={userLocation}
            highlightedPlaceId={highlightedPlaceId ?? listData[0]?.id ?? null}
            onMarkerPress={handleMarkerPress}
          />
        </Animated.View>
      )}
      <View className="flex-1">{renderListContent()}</View>
    </View>
  );
}
