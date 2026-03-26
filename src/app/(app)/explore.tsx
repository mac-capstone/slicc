import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Platform, Pressable, Text, View } from 'react-native';
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
import { getDietaryPreferenceIds } from '@/lib/hooks/use-user-settings';

import { ExploreContent } from './explore-content';
import { ExploreEmptyMessage } from './explore-empty-message';
import { type CategoryFilter, ExploreFilters } from './explore-filters';
import type { SectionFilter } from './explore-types';

function placeMatchesCategory(place: Place, category: CategoryFilter): boolean {
  if (category === 'all') return true;
  const types = [place.primaryType, ...(place.types ?? [])].filter(
    (t): t is string => !!t
  );
  return types.some(
    (t) =>
      t === category || (typeof t === 'string' && t.startsWith(`${category}_`))
  );
}

function placeMatchesSearch(place: Place, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (place.displayName ?? '').toLowerCase();
  const address = (place.formattedAddress ?? '').toLowerCase();
  return name.includes(q) || address.includes(q);
}

const LOADING_PLACEHOLDER_ID = '__loading__';

function sortedPlaceIdsKey(places: Place[]): string {
  return places
    .map((p) => p.id)
    .sort()
    .join(',');
}

type ExploreSection = {
  id: string;
  title: string;
  data: (Place | { id: string })[];
  isLoading?: boolean;
};

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const userId = useAuth.use.userId();
  const viewerDietaryPreferenceIds = useMemo(
    () => getDietaryPreferenceIds(userId ?? null),
    [userId]
  );
  const { location: userLocation, status: locationStatus } = useUserLocation();
  const likedPlaces = useLikedPlaces();
  const ratedPlaceIds = useRatedPlaceIds();
  const likedPlacesRef = useRef(likedPlaces);
  likedPlacesRef.current = likedPlaces;

  /** Snapshot for the recommendations query — avoids refetch on every like while on Recommended. */
  const [recommendationLikesBasis, setRecommendationLikesBasis] = useState<
    Place[]
  >([]);

  useEffect(() => {
    if (sectionFilter !== 'recommended') {
      setRecommendationLikesBasis(likedPlaces);
      return;
    }
    setRecommendationLikesBasis((prev) => {
      if (prev.length === 0 && likedPlaces.length > 0) {
        return likedPlaces;
      }
      return prev;
    });
  }, [sectionFilter, likedPlaces]);

  useFocusEffect(
    useCallback(() => {
      if (sectionFilter === 'recommended') {
        setRecommendationLikesBasis(likedPlacesRef.current);
      }
    }, [sectionFilter])
  );

  const likesForRecommendationsQuery = useMemo((): Place[] => {
    if (sectionFilter !== 'recommended') {
      return likedPlaces;
    }
    if (recommendationLikesBasis.length === 0 && likedPlaces.length > 0) {
      return likedPlaces;
    }
    return recommendationLikesBasis.length > 0
      ? recommendationLikesBasis
      : likedPlaces;
  }, [sectionFilter, likedPlaces, recommendationLikesBasis]);

  const handleRefreshRecommendations = useCallback((): void => {
    setRecommendationLikesBasis(likedPlaces);
  }, [likedPlaces]);

  const isSearching = searchQuery.trim().length >= 2;
  const hasLikes = likedPlaces.length > 0;
  const hasLocation = !!userLocation;

  const recommendationsOutOfDate =
    sectionFilter === 'recommended' &&
    hasLikes &&
    sortedPlaceIdsKey(recommendationLikesBasis) !==
      sortedPlaceIdsKey(likedPlaces) &&
    !(recommendationLikesBasis.length === 0 && likedPlaces.length > 0);

  const includedTypesForNearby =
    categoryFilter === 'all' ? undefined : [categoryFilter];

  const usesApiSearch =
    isSearching &&
    (sectionFilter === 'all' || (sectionFilter === 'nearby' && hasLocation));

  const {
    data: searchResults,
    isPending: searchPending,
    isError: searchError,
    error: searchErrorDetail,
  } = usePlaces({
    searchQuery,
    userLocation,
    enabled: usesApiSearch,
  });

  const {
    data: recommendations,
    isPending: recsPending,
    isError: recsError,
    error: recsErrorDetail,
  } = useRecommendations({
    likedPlaces: likesForRecommendationsQuery,
    userLocation,
    ratedPlaceIds,
    userId,
    viewerDietaryPreferenceIds,
    enabled: hasLikes && (sectionFilter === 'recommended' || !isSearching),
  });

  const {
    data: nearbyPlaces,
    isPending: nearbyPending,
    isError: nearbyError,
    error: nearbyErrorDetail,
  } = usePlaces({
    searchQuery: '',
    userLocation,
    enabled: !isSearching && hasLocation,
    includedTypes: includedTypesForNearby,
  });

  const sections = useMemo((): ExploreSection[] => {
    if (isSearching) return [];

    const filteredFavorites =
      categoryFilter === 'all'
        ? likedPlaces
        : likedPlaces.filter((p) => placeMatchesCategory(p, categoryFilter));

    const forYouData = recommendations ?? [];
    const filteredRecommendations =
      categoryFilter === 'all'
        ? forYouData
        : forYouData.filter((p) => placeMatchesCategory(p, categoryFilter));

    const result: ExploreSection[] = [];

    const showFavorites = sectionFilter === 'favorites';
    const showRecommended = sectionFilter === 'recommended';
    const showNearby = sectionFilter === 'nearby';

    if (showFavorites) {
      result.push({
        id: 'favorites',
        title: 'Your favorites',
        data: filteredFavorites,
      });
    }

    if (showRecommended) {
      result.push({
        id: 'for-you',
        title: 'For you',
        data:
          recsPending && filteredRecommendations.length === 0
            ? [{ id: `${LOADING_PLACEHOLDER_ID}-for-you` }]
            : filteredRecommendations,
        isLoading: recsPending,
      });
    }

    if (showNearby) {
      const nearbyData = nearbyPlaces ?? [];
      result.push({
        id: 'nearby',
        title: 'Nearby',
        data:
          nearbyPending && nearbyData.length === 0
            ? [{ id: `${LOADING_PLACEHOLDER_ID}-nearby` }]
            : nearbyData,
        isLoading: nearbyPending,
      });
    }

    return result;
  }, [
    isSearching,
    likedPlaces,
    recommendations,
    recsPending,
    nearbyPlaces,
    nearbyPending,
    categoryFilter,
    sectionFilter,
  ]);

  const hasApiKey = hasPlacesApiKey();

  const activeError =
    (usesApiSearch && searchError ? searchErrorDetail : null) ??
    (!isSearching && hasLikes && recsError ? recsErrorDetail : null) ??
    (!isSearching && hasLocation && nearbyError ? nearbyErrorDetail : null);

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

  const searchViewData = useMemo((): Place[] | null => {
    if (!isSearching) return null;
    const q = searchQuery.trim();

    if (sectionFilter === 'all') {
      return searchResults ?? [];
    }
    if (sectionFilter === 'favorites') {
      let data = likedPlaces;
      if (categoryFilter !== 'all') {
        data = data.filter((p) => placeMatchesCategory(p, categoryFilter));
      }
      return data.filter((p) => placeMatchesSearch(p, q));
    }
    if (sectionFilter === 'recommended') {
      let data = recommendations ?? [];
      if (categoryFilter !== 'all') {
        data = data.filter((p) => placeMatchesCategory(p, categoryFilter));
      }
      return data.filter((p) => placeMatchesSearch(p, q));
    }
    if (sectionFilter === 'nearby') {
      return hasLocation ? (searchResults ?? []) : [];
    }
    return [];
  }, [
    isSearching,
    searchQuery,
    sectionFilter,
    categoryFilter,
    likedPlaces,
    recommendations,
    searchResults,
    hasLocation,
  ]);

  const searchViewLoading =
    isSearching &&
    ((sectionFilter === 'all' && searchPending) ||
      (sectionFilter === 'recommended' && recsPending) ||
      (sectionFilter === 'nearby' && hasLocation && searchPending));

  const searchViewEmpty =
    isSearching && !searchViewLoading && (searchViewData?.length ?? 0) === 0;

  const showSearchView = isSearching;

  const hasContent = isSearching
    ? (searchViewData?.length ?? 0) > 0
    : sections.some((s) => s.data.length > 0);
  const isLoading =
    (isSearching && searchViewLoading) ||
    (!isSearching &&
      sectionFilter === 'recommended' &&
      hasLikes &&
      recsPending) ||
    (!isSearching && hasLocation && nearbyPending);
  const initialLoad = !isSearching && isLoading && !hasContent;

  const currentPlaces: Place[] = showSearchView
    ? (searchViewData ?? [])
    : sections.flatMap((s) =>
        s.data.filter((item): item is Place => 'displayName' in item)
      );

  if (!hasApiKey || isApiKeyError) {
    return (
      <View className="flex-1">
        <View className="border-b border-neutral-800 px-4 pb-3 pt-2">
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search restaurants, cafes..."
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
            sectionFilter={sectionFilter}
            hasLocation={hasLocation}
            hasLikes={hasLikes}
            isSearching={isSearching}
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
        sectionFilter={sectionFilter}
        onSectionFilterChange={setSectionFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />
      <ExploreContent
        sectionFilter={sectionFilter}
        hasContent={hasContent}
        currentPlaces={currentPlaces}
        showSearchView={showSearchView}
        searchViewLoading={searchViewLoading}
        searchViewEmpty={searchViewEmpty}
        searchViewData={searchViewData}
        searchQuery={searchQuery}
        sections={sections}
        initialLoad={initialLoad}
        userLocation={userLocation}
        hasApiKey={hasApiKey}
        isApiKeyError={isApiKeyError}
        hasLocation={hasLocation}
        hasLikes={hasLikes}
        isSearching={isSearching}
        locationStatus={locationStatus}
        onPlacePress={handlePlacePress}
      />
      {recommendationsOutOfDate ? (
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
