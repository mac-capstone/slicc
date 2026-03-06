import Feather from '@expo/vector-icons/Feather';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AddButton } from '@/components/add-button';
import {
  GroupEventCard,
  type GroupEventCardData,
} from '@/components/group-event-card';
import { SearchableSectionHeader } from '@/components/searchable-section-header';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchInputVisible, setIsSearchInputVisible] = useState(false);

  const allUpcomingEvents = useMemo((): GroupEventCardData[] => {
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

  const upcomingEvents = useMemo(() => {
    if (!searchQuery.trim()) return allUpcomingEvents;
    const query = searchQuery.trim().toLowerCase();
    return allUpcomingEvents.filter((e) =>
      e.name.toLowerCase().includes(query)
    );
  }, [allUpcomingEvents, searchQuery]);

  const handleBack = () => router.back();
  const handleSettings = () => {};
  const handleEventPress = (eventId: string) =>
    router.push(`/event/${eventId}` as const);
  const handleNewEvent = () =>
    router.push(`/event/edit-event?groupId=${groupId}` as const);

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
          <SearchableSectionHeader
            title="Upcoming Events"
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            isSearchInputVisible={isSearchInputVisible}
            onSearchInputVisibleChange={setIsSearchInputVisible}
            placeholder="Search events..."
            searchLabel="Search events"
            clearSearchLabel="Clear search"
          />
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
