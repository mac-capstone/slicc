import Octicons from '@expo/vector-icons/Octicons';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
  clearPlaceRating,
  type PlaceRating,
  setPlaceRating,
  usePlacePreferences,
} from '@/lib';
import { useUserLocation } from '@/lib/hooks/use-user-location';

const TABS = ['Liked', 'Okay', 'Nah'] as const;
type Tab = (typeof TABS)[number];

const TAB_COLORS: Record<Tab, string> = {
  Liked: colors.success[500],
  Okay: colors.warning[500],
  Nah: colors.danger[500],
};

type Snapshot = {
  placeRatings: Record<string, PlaceRating>;
  placeDetails: Record<string, Place>;
};

type PendingChange = PlaceRating | 'cleared';

function buildTabLists(snapshot: Snapshot): Record<Tab, Place[]> {
  const liked: Place[] = [];
  const okay: Place[] = [];
  const disliked: Place[] = [];

  for (const [id, originalRating] of Object.entries(snapshot.placeRatings)) {
    const place = snapshot.placeDetails[id];
    if (!place) continue;

    if (originalRating === 'up') liked.push(place);
    else if (originalRating === 'neutral') okay.push(place);
    else if (originalRating === 'down') disliked.push(place);
  }

  return { Liked: liked, Okay: okay, Nah: disliked };
}

export default function ExploreRated(): React.ReactElement {
  const navigation = useNavigation();
  const { location: userLocation } = useUserLocation();
  const [activeTab, setActiveTab] = useState<Tab>('Liked');

  const storeRatings = usePlacePreferences.use.placeRatings();
  const storeDetails = usePlacePreferences.use.placeDetails();

  const [snapshot, setSnapshot] = useState<Snapshot>({
    placeRatings: storeRatings,
    placeDetails: storeDetails,
  });

  const [pendingChanges, setPendingChanges] = useState<
    Record<string, PendingChange>
  >({});

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const pendingRef = useRef(pendingChanges);
  pendingRef.current = pendingChanges;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const tabData = useMemo(() => buildTabLists(snapshot), [snapshot]);

  const flushChanges = useCallback(() => {
    for (const [id, change] of Object.entries(pendingChanges)) {
      const place = snapshot.placeDetails[id];
      if (change === 'cleared') {
        clearPlaceRating(id);
      } else if (place) {
        setPlaceRating(id, change, place);
      }
    }
    setPendingChanges({});
    const next = usePlacePreferences.getState();
    setSnapshot({
      placeRatings: next.placeRatings,
      placeDetails: next.placeDetails,
    });
  }, [pendingChanges, snapshot]);

  const confirmLeave = useCallback(() => {
    if (Object.keys(pendingRef.current).length === 0) {
      router.navigate('/explore');
      return;
    }
    Alert.alert(
      'Unsaved changes',
      'You have unsaved rating changes. What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setPendingChanges({});
            router.navigate('/explore');
          },
        },
        {
          text: 'Save & leave',
          onPress: () => {
            const cur = pendingRef.current;
            const snap = snapshotRef.current;
            for (const [id, change] of Object.entries(cur)) {
              const place = snap.placeDetails[id];
              if (change === 'cleared') {
                clearPlaceRating(id);
              } else if (place) {
                setPlaceRating(id, change, place);
              }
            }
            setPendingChanges({});
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

  const handleRate = useCallback(
    (placeId: string, rating: PlaceRating) => {
      const originalRating = snapshot.placeRatings[placeId];
      const currentEffective =
        pendingChanges[placeId] !== undefined
          ? pendingChanges[placeId]
          : originalRating;

      let next: PendingChange;
      if (currentEffective === rating) {
        next = 'cleared';
      } else {
        next = rating;
      }

      if (next === originalRating) {
        const { [placeId]: _, ...rest } = pendingChanges;
        setPendingChanges(rest);
      } else {
        setPendingChanges({ ...pendingChanges, [placeId]: next });
      }
    },
    [pendingChanges, snapshot]
  );

  const places = tabData[activeTab];

  const renderItem = useCallback(
    ({ item }: { item: Place }) => {
      const effective =
        pendingChanges[item.id] !== undefined
          ? pendingChanges[item.id]
          : snapshot.placeRatings[item.id];
      const resolvedRating =
        effective === 'cleared' ? undefined : (effective as PlaceRating);

      return (
        <View>
          <PlaceCard
            place={item}
            userLocation={userLocation}
            showRatingButtons={true}
            onPress={() => handlePlacePress(item)}
            ratingValue={resolvedRating}
            onRate={(r) => handleRate(item.id, r)}
          />
        </View>
      );
    },
    [userLocation, pendingChanges, snapshot, handlePlacePress, handleRate]
  );

  return (
    <View className="flex-1">
      <View className="flex-row gap-2 border-b border-neutral-800 px-4 pb-3 pt-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const count = tabData[tab].length;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 items-center rounded-full py-2"
              style={{
                backgroundColor: isActive ? 'transparent' : colors.neutral[800],
                borderWidth: isActive ? 2 : 1,
                borderColor: isActive ? TAB_COLORS[tab] : colors.neutral[700],
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                className="text-sm font-medium"
                style={{
                  color: isActive ? TAB_COLORS[tab] : colors.text[800],
                }}
              >
                {tab} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {places.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className="text-center text-base"
            style={{ color: colors.text[800] }}
          >
            {activeTab === 'Liked' && 'No liked places yet.'}
            {activeTab === 'Okay' && 'No places marked as okay yet.'}
            {activeTab === 'Nah' && 'No disliked places yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={places}
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
            accessibilityLabel="Save rating changes"
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
