import Feather from '@expo/vector-icons/Feather';
import Octicons from '@expo/vector-icons/Octicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AddButton } from '@/components/add-button';
import {
  GroupEventCard,
  type GroupEventCardData,
} from '@/components/group-event-card';
import { colors, Text } from '@/components/ui';
import { mockData } from '@/lib/mock-data';
import { useThemeConfig } from '@/lib/use-theme-config';
import type { GroupIdT, UserIdT } from '@/types';

export default function GroupDetailScreen() {
  const theme = useThemeConfig();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id as GroupIdT;

  const group = useMemo(
    () => mockData.groups.find((g) => g.id === groupId),
    [groupId]
  );

  const upcomingEvents = useMemo((): GroupEventCardData[] => {
    if (!group) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return group.doc.eventIds
      .map((id) => mockData.events.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => e != null)
      .filter((e) => new Date(e.doc.startDate).getTime() >= today.getTime())
      .sort(
        (a, b) =>
          new Date(a.doc.startDate).getTime() -
          new Date(b.doc.startDate).getTime()
      )
      .map((e) => ({
        id: e.id,
        name: e.doc.name,
        startDate: e.doc.startDate,
        startTime: e.doc.startTime,
        location: e.doc.location,
        participants: e.doc.participants as UserIdT[],
      }));
  }, [group]);

  const handleBack = () => router.back();
  const handleSettings = () => {};
  const handleSearch = () => {};
  const handleEventPress = (eventId: string) =>
    router.push(`/event/${eventId}` as const);
  const handleNewEvent = () => {};

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">Group not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: group.doc.title,
          headerShown: true,
          headerTitleStyle: {
            fontSize: 28,
            fontWeight: 'bold',
          },
          headerStyle: {
            backgroundColor: theme.dark ? '#1A1A1A' : '#fff',
          },
          headerTintColor: theme.dark ? '#fff' : '#000',
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={handleBack} className="px-2">
              <Feather
                name="arrow-left"
                size={24}
                color={theme.dark ? '#fff' : '#000'}
              />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleSettings} className="px-2">
              <Feather
                name="chevron-right"
                size={24}
                color={theme.dark ? '#fff' : '#000'}
              />
            </Pressable>
          ),
        }}
      />
      <View className="flex-1 bg-background-950">
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View className="flex-row items-center py-3">
            <View className="flex-1" />
            <Text
              className="font-futuraDemi text-lg"
              style={{ color: colors.text[800] }}
            >
              Upcoming Events
            </Text>
            <View className="flex-1 flex-row justify-end">
              <Pressable
                onPress={handleSearch}
                className="p-2"
                accessibilityLabel="Search events"
                accessibilityRole="button"
              >
                <Octicons name="search" size={20} color={colors.text[800]} />
              </Pressable>
            </View>
          </View>
          <View className="mb-4 h-px bg-neutral-700" />

          {upcomingEvents.map((event) => (
            <GroupEventCard
              key={event.id}
              event={event}
              onPress={() => handleEventPress(event.id)}
            />
          ))}

          <AddButton
            label="Create New Event"
            onPress={handleNewEvent}
            className="mt-2"
            borderColor={colors.white}
            borderWidth={1.2}
            heightClassName="h-14"
          />
        </ScrollView>
      </View>
    </>
  );
}
