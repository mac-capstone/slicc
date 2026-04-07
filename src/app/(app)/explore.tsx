import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';

import type { Place } from '@/api/places/places-api';
import {
  hasPlacesApiKey,
  isPlacesApiConfigError,
} from '@/api/places/places-api';
import { usePlaces } from '@/api/places/use-places';
import { useRecommendations } from '@/api/places/use-recommendations';
import { colors, Input } from '@/components/ui';
import { useAuth, useLikedPlaces, useRatedPlaceIds } from '@/lib';
import { useUserLocation } from '@/lib/hooks/use-user-location';
import { useUserSettings } from '@/lib/hooks/use-user-settings';
import { usePlacePreferences } from '@/lib/place-preferences';

import { ExploreContent } from './explore-content';
import { ExploreEmptyMessage } from './explore-empty-message';
import { type CategoryFilter, ExploreFilters } from './explore-filters';

function sortedIdsKey(ids: Set<string>): string {
  return Array.from(ids).sort().join(',');
}

const ENTERTAINMENT_TYPES = new Set([
  'amusement_center',
  'amusement_park',
  'aquarium',
  'casino',
  'comedy_club',
  'concert_hall',
  'dance_hall',
  'event_venue',
  'karaoke',
  'live_music_venue',
  'movie_theater',
  'night_club',
  'opera_house',
  'performing_arts_theater',
  'roller_coaster',
  'video_arcade',
  'water_park',
  'zoo',
]);

const SPORTS_TYPES = new Set([
  'arena',
  'athletic_field',
  'bowling_alley',
  'fitness_center',
  'go_karting_venue',
  'golf_course',
  'gym',
  'ice_skating_rink',
  'miniature_golf_course',
  'paintball_center',
  'playground',
  'skateboard_park',
  'sports_activity_location',
  'sports_club',
  'sports_complex',
  'stadium',
  'swimming_pool',
  'tennis_court',
]);

const CATEGORY_TYPE_SETS: Partial<Record<CategoryFilter, Set<string>>> = {
  entertainment: ENTERTAINMENT_TYPES,
  sports: SPORTS_TYPES,
};

function placeMatchesCategory(place: Place, category: CategoryFilter): boolean {
  if (category === 'all') return true;
  const types = [place.primaryType, ...(place.types ?? [])].filter(
    (t): t is string => !!t
  );
  const typeSet = CATEGORY_TYPE_SETS[category];
  if (typeSet) {
    return types.some((t) => typeSet.has(t));
  }
  return types.some((t) => t === category || t.startsWith(`${category}_`));
}

function filterPlacesByCategory(
  places: Place[],
  categoryFilter: CategoryFilter
): Place[] {
  if (categoryFilter === 'all') return places;
  return places.filter((p) => placeMatchesCategory(p, categoryFilter));
}

function sortedPlaceIdsKey(places: Place[]): string {
  return places
    .map((p) => p.id)
    .sort()
    .join(',');
}

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showMap, setShowMap] = useState(false);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const isFirstFocus = useRef(true);
  const userId = useAuth.use.userId();
  const { dietaryPreferenceIds: viewerDietaryPreferenceIds } =
    useUserSettings();
  const { location: userLocation, status: locationStatus } = useUserLocation();
  const likedPlaces = useLikedPlaces();
  const ratedPlaceIds = useRatedPlaceIds();
  const placeRatings = usePlacePreferences.use.placeRatings();
  const likedPlacesRef = useRef(likedPlaces);
  likedPlacesRef.current = likedPlaces;
  const ratedPlaceIdsRef = useRef(ratedPlaceIds);
  ratedPlaceIdsRef.current = ratedPlaceIds;

  const [recommendationLikesBasis, setRecommendationLikesBasis] = useState<
    Place[]
  >([]);
  const [ratedIdsBasis, setRatedIdsBasis] = useState<Set<string>>(
    new Set<string>()
  );

  useEffect(() => {
    setRecommendationLikesBasis((prev) => {
      if (prev.length === 0 && likedPlaces.length > 0) return likedPlaces;
      return prev;
    });
  }, [likedPlaces]);

  useEffect(() => {
    setRatedIdsBasis((prev) => {
      if (prev.size === 0 && ratedPlaceIds.size > 0) return ratedPlaceIds;
      return prev;
    });
  }, [ratedPlaceIds]);

  const refreshBasis = useCallback(() => {
    setRecommendationLikesBasis(likedPlacesRef.current);
    setRatedIdsBasis(ratedPlaceIdsRef.current);
  }, []);

  useFocusEffect(refreshBasis);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      setMapRefreshKey((prev) => prev + 1);
    }, [])
  );

  const likesForQuery = useMemo((): Place[] => {
    if (recommendationLikesBasis.length === 0 && likedPlaces.length > 0) {
      return likedPlaces;
    }
    return recommendationLikesBasis.length > 0
      ? recommendationLikesBasis
      : likedPlaces;
  }, [likedPlaces, recommendationLikesBasis]);

  const ratedIdsForQuery = useMemo((): Set<string> => {
    if (ratedIdsBasis.size === 0 && ratedPlaceIds.size > 0) {
      return ratedPlaceIds;
    }
    return ratedIdsBasis.size > 0 ? ratedIdsBasis : ratedPlaceIds;
  }, [ratedPlaceIds, ratedIdsBasis]);

  const handleRefreshRecommendations = useCallback((): void => {
    refreshBasis();
  }, [refreshBasis]);

  const isSearching = searchQuery.trim().length >= 2;
  const hasLikes = likedPlaces.length > 0;
  const hasLocation = !!userLocation;

  const likesChanged =
    hasLikes &&
    sortedPlaceIdsKey(recommendationLikesBasis) !==
      sortedPlaceIdsKey(likedPlaces) &&
    !(recommendationLikesBasis.length === 0 && likedPlaces.length > 0);

  const ratedIdsChanged =
    sortedIdsKey(ratedIdsBasis) !== sortedIdsKey(ratedPlaceIds) &&
    !(ratedIdsBasis.size === 0 && ratedPlaceIds.size > 0);

  const recommendationsOutOfDate = likesChanged || ratedIdsChanged;

  const {
    data: searchResults,
    isPending: searchPending,
    isError: searchError,
    error: searchErrorDetail,
  } = usePlaces({
    searchQuery,
    userLocation,
    enabled: isSearching,
  });

  const {
    data: recommendationResult,
    isPending: recsPending,
    isError: recsError,
    error: recsErrorDetail,
  } = useRecommendations({
    likedPlaces: likesForQuery,
    userLocation,
    ratedPlaceIds: ratedIdsForQuery,
    userId,
    viewerDietaryPreferenceIds,
    placeRatings,
    enabled: hasLikes && hasLocation && !isSearching,
  });

  const recommendations = recommendationResult?.places;
  const scoreById = recommendationResult?.scoreById;

  const hasApiKey = hasPlacesApiKey();

  const activeError =
    (isSearching && searchError ? searchErrorDetail : null) ??
    (!isSearching && hasLikes && recsError ? recsErrorDetail : null);

  const isApiKeyError = useMemo(() => {
    if (!activeError) return false;
    if (isPlacesApiConfigError(activeError)) return true;
    const msg = String((activeError as Error).message ?? '').toLowerCase();
    return (
      msg.includes('403') ||
      msg.includes('401') ||
      msg.includes('api key') ||
      msg.includes('invalid') ||
      msg.includes('forbidden') ||
      msg.includes('unauthorized') ||
      msg.includes('permission_denied') ||
      msg.includes('restriction')
    );
  }, [activeError]);

  const handlePlacePress = useCallback((place: Place) => {
    Keyboard.dismiss();
    router.push({
      pathname: '/place/[place-id]',
      params: { 'place-id': place.id, returnTo: 'explore' },
    });
  }, []);

  const handleToggleMap = useCallback((): void => {
    refreshBasis();
    setShowMap((prev) => !prev);
  }, [refreshBasis]);

  const handleCategoryFilterChange = useCallback(
    (filter: CategoryFilter): void => {
      setCategoryFilter(filter);
    },
    []
  );

  const searchViewData = useMemo((): Place[] | null => {
    if (!isSearching) return null;
    return filterPlacesByCategory(searchResults ?? [], categoryFilter);
  }, [isSearching, searchResults, categoryFilter]);

  const searchViewLoading = isSearching && searchPending;
  const searchViewEmpty =
    isSearching && !searchViewLoading && (searchViewData?.length ?? 0) === 0;
  const showSearchView = isSearching;

  const browseData = useMemo(
    (): Place[] =>
      filterPlacesByCategory(recommendations ?? [], categoryFilter),
    [recommendations, categoryFilter]
  );

  const mapPlaces = useMemo(
    (): Place[] =>
      isSearching
        ? filterPlacesByCategory(searchResults ?? [], categoryFilter)
        : filterPlacesByCategory(recommendations ?? [], categoryFilter),
    [isSearching, searchResults, recommendations, categoryFilter]
  );

  if (locationStatus === null) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.accent[100]} />
      </View>
    );
  }

  if (!hasApiKey || isApiKeyError) {
    return (
      <View className="flex-1">
        <View className="border-b border-neutral-800 px-4 pb-3 pt-2">
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search places..."
            placeholderTextColor={colors.neutral[400]}
            style={{ color: colors.white, borderColor: colors.neutral[600] }}
            containerClassName="mb-0"
            inputClassName="dark:text-white"
          />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <ExploreEmptyMessage
            hasApiKey={hasApiKey}
            isApiKeyError={isApiKeyError}
            hasLocation={hasLocation}
            hasLikes={hasLikes}
            isSearching={isSearching}
            showMap={showMap}
            locationStatus={locationStatus}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ExploreFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={handleCategoryFilterChange}
        showMap={showMap}
        onToggleMap={handleToggleMap}
        hasLocation={hasLocation}
      />
      <ExploreContent
        showMap={showMap && hasLocation}
        mapPlaces={mapPlaces}
        showSearchView={showSearchView}
        searchViewLoading={searchViewLoading}
        searchViewEmpty={searchViewEmpty}
        searchViewData={searchViewData}
        searchQuery={searchQuery}
        browseData={browseData}
        browseLoading={recsPending}
        userLocation={userLocation}
        hasApiKey={hasApiKey}
        isApiKeyError={isApiKeyError}
        hasLocation={hasLocation}
        hasLikes={hasLikes}
        isSearching={isSearching}
        showMapToggle={showMap}
        locationStatus={locationStatus}
        onPlacePress={handlePlacePress}
        mapRefreshKey={mapRefreshKey}
        scoreById={scoreById}
      />
      {recommendationsOutOfDate && !isSearching ? (
        <Animated.View
          entering={FadeInUp.springify().damping(40).stiffness(220)}
          exiting={FadeOutDown.duration(200)}
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 12,
            zIndex: 50,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOpacity: 0.35,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
              },
              android: { elevation: 14 },
            }),
          }}
        >
          <Pressable
            onPress={handleRefreshRecommendations}
            className="rounded-2xl px-4 py-3.5"
            style={{
              backgroundColor: colors.background[900],
              borderWidth: 1,
              borderColor: colors.text[800],
            }}
            accessibilityRole="button"
            accessibilityLabel="Refresh recommendations based on your latest likes"
          >
            <Text
              className="text-center text-sm font-semibold"
              style={{ color: colors.text[800] }}
            >
              Refresh recommendations
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}
