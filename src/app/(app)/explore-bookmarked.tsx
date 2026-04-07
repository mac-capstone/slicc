import Octicons from '@expo/vector-icons/Octicons';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
} from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';

import type { Place } from '@/api/places/places-api';
import { PlaceCard } from '@/components/place-card';
import { colors, Text, TouchableOpacity, View } from '@/components/ui';
import {
  getBookmarkedPlaces,
  toggleBookmark,
  useBookmarkedPlaces,
} from '@/lib';
import { useUserLocation } from '@/lib/hooks/use-user-location';

export default function ExploreBookmarked(): React.ReactElement {
  const navigation = useNavigation();
  const bookmarkedPlaces = useBookmarkedPlaces();
  const { location: userLocation } = useUserLocation();

  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(
    new Set()
  );

  const hasPendingChanges = pendingRemovals.size > 0;
  const pendingRef = useRef(pendingRemovals);
  pendingRef.current = pendingRemovals;

  useEffect(() => {
    const ids = new Set(bookmarkedPlaces.map((p) => p.id));
    setPendingRemovals((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [bookmarkedPlaces]);

  const flushChanges = useCallback(() => {
    const bookmarkedIds = new Set(getBookmarkedPlaces().map((p) => p.id));
    for (const id of pendingRemovals) {
      if (bookmarkedIds.has(id)) toggleBookmark(id);
    }
    setPendingRemovals(new Set());
  }, [pendingRemovals]);

  const confirmLeave = useCallback(() => {
    if (pendingRef.current.size === 0) {
      router.navigate('/explore');
      return;
    }
    Alert.alert(
      'Unsaved changes',
      'You have unsaved bookmark changes. What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setPendingRemovals(new Set());
            router.navigate('/explore');
          },
        },
        {
          text: 'Save & leave',
          onPress: () => {
            const bookmarkedIds = new Set(
              getBookmarkedPlaces().map((p) => p.id)
            );
            for (const id of pendingRef.current) {
              if (bookmarkedIds.has(id)) toggleBookmark(id);
            }
            setPendingRemovals(new Set());
            router.navigate('/explore');
          },
        },
      ]
    );
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={confirmLeave}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          activeOpacity={0.6}
        >
          <Octicons name="arrow-left" size={24} color={colors.text[800]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, confirmLeave]);

  useEffect(() => {
    const handler = () => {
      confirmLeave();
      return true;
    };
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handler
    );
    return () => subscription.remove();
  }, [confirmLeave]);

  const handlePlacePress = useCallback((place: Place) => {
    Keyboard.dismiss();
    router.push({
      pathname: '/place/[place-id]',
      params: { 'place-id': place.id, returnTo: 'explore' },
    });
  }, []);

  const handleToggleBookmark = useCallback((placeId: string) => {
    setPendingRemovals((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      return next;
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Place }) => {
      const isRemoved = pendingRemovals.has(item.id);
      return (
        <View>
          <PlaceCard
            place={item}
            userLocation={userLocation}
            showRatingButtons={true}
            onPress={() => handlePlacePress(item)}
            bookmarkedValue={!isRemoved}
            onBookmarkToggle={() => handleToggleBookmark(item.id)}
          />
        </View>
      );
    },
    [userLocation, pendingRemovals, handlePlacePress, handleToggleBookmark]
  );

  return (
    <View className="flex-1">
      {bookmarkedPlaces.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className="text-center text-base"
            style={{ color: colors.text[800] }}
          >
            No bookmarked places yet. Save places you enjoy to see them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarkedPlaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 80,
          }}
          renderItem={renderItem}
        />
      )}

      {hasPendingChanges ? (
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
            onPress={flushChanges}
            className="rounded-2xl px-4 py-3.5"
            style={{
              backgroundColor: colors.background[900],
              borderWidth: 1,
              borderColor: colors.text[800],
            }}
            accessibilityRole="button"
            accessibilityLabel="Save bookmark changes"
          >
            <Text
              className="text-center text-sm font-semibold"
              style={{ color: colors.text[800] }}
            >
              Save Changes
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}
