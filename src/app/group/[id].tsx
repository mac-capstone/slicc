import Feather from '@expo/vector-icons/Feather';
import Octicons from '@expo/vector-icons/Octicons';
import { useFocusEffect } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, TouchableOpacity, View } from 'react-native';

import { useEventsByGroupId } from '@/api/events/use-events';
import { useGroup } from '@/api/groups/use-groups';
import { AddButton } from '@/components/add-button';
import { UpcomingEventsSection } from '@/components/dashboard/upcoming-events-section';
import { SearchableSectionHeader } from '@/components/searchable-section-header';
import { colors, Text } from '@/components/ui';
import { categorizeEvents } from '@/lib/event-utils';
import { markGroupAsRead } from '@/lib/group-preferences';
import { useThemeConfig } from '@/lib/use-theme-config';
import type { GroupIdT } from '@/types';

export default function GroupDetailScreen() {
  const theme = useThemeConfig();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id as GroupIdT;

  const {
    data: group,
    isPending,
    isError,
  } = useGroup({
    variables: groupId,
  });
  const {
    data: events = [],
    isPending: eventsPending,
    isError: eventsError,
  } = useEventsByGroupId({
    variables: groupId,
    enabled: Boolean(groupId),
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchInputVisible, setIsSearchInputVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const timeoutId = setTimeout(() => {
        markGroupAsRead(groupId);
      }, 1500);
      return () => clearTimeout(timeoutId);
    }, [groupId])
  );

  const categorized = useMemo(() => categorizeEvents(events), [events]);

  const filteredCategorized = useMemo(() => {
    if (!searchQuery.trim()) return categorized;
    const q = searchQuery.trim().toLowerCase();
    return {
      current: categorized.current.filter((e) =>
        e.name.toLowerCase().includes(q)
      ),
      upcoming: categorized.upcoming.filter((e) =>
        e.name.toLowerCase().includes(q)
      ),
      past: categorized.past.filter((e) => e.name.toLowerCase().includes(q)),
    };
  }, [categorized, searchQuery]);

  const handleBack = () =>
    router.push({ pathname: '/social', params: { segment: 'groups' } });
  const handleEditGroup = () =>
    router.push(`/group/edit?groupId=${groupId}` as const);
  const handleNewEvent = () =>
    router.push(`/event/edit-event?groupId=${groupId}` as const);

  if (isPending || isError || !group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">
          {isPending ? 'Loading...' : 'Group not found'}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          title: group.name,
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
            <Pressable
              onPress={() => {
                console.log('backing from group details');
                handleBack();
              }}
              className="px-2"
            >
              <Feather
                name="arrow-left"
                size={24}
                color={theme.dark ? '#fff' : '#000'}
              />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleEditGroup}
              className="px-2"
              accessibilityRole="button"
              accessibilityLabel="Edit group"
            >
              <Feather
                name="edit-2"
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
            title="Events"
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            isSearchInputVisible={isSearchInputVisible}
            onSearchInputVisibleChange={setIsSearchInputVisible}
            placeholder="Search events..."
            searchLabel="Search events"
            clearSearchLabel="Clear search"
          />
          <View className="mb-4 h-px bg-neutral-700" />

          <UpcomingEventsSection
            categorized={filteredCategorized}
            isPending={eventsPending}
            isError={eventsError}
          />

          <AddButton
            label="Create New Event"
            onPress={handleNewEvent}
            className="mt-2"
            borderColor={colors.white}
            borderWidth={1.2}
            heightClassName="h-14"
          />
        </ScrollView>

        <TouchableOpacity
          onPress={() => router.push(`/chat/${groupId}` as const)}
          className="absolute bottom-6 right-5 size-14 items-center justify-center rounded-full bg-accent-800"
          style={{ elevation: 6 }}
          accessibilityLabel="Open group chat"
          accessibilityRole="button"
        >
          <Octicons name="comment-discussion" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
