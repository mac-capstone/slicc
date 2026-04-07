import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

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

/**
 * Group detail: events list and create. Members / edit: `/group/[id]/members` and `/group/edit`.
 */
export default function GroupDetailScreen() {
  const theme = useThemeConfig();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id as GroupIdT | undefined;

  const {
    data: group,
    isPending,
    isError,
  } = useGroup({
    variables: groupId!,
    enabled: Boolean(groupId),
  });
  const {
    data: events = [],
    isPending: eventsPending,
    isError: eventsError,
  } = useEventsByGroupId({
    variables: groupId!,
    enabled: Boolean(groupId),
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchInputVisible, setIsSearchInputVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;
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

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push({ pathname: '/social', params: { segment: 'groups' } });
    }
  }, []);
  const handleSettings = useCallback(
    () => router.push(`/group/${groupId}/members` as const),
    [groupId]
  );
  const handleNewEvent = useCallback(
    () => router.push(`/event/edit-event?groupId=${groupId}` as const),
    [groupId]
  );

  if (!groupId || isPending || isError || !group) {
    let message = 'Group not found';
    if (!groupId) message = 'Group not found';
    else if (isPending) message = 'Loading...';
    else if (isError) message = 'Failed to load group';

    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">{message}</Text>
      </View>
    );
  }

  return (
    <>
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
            <Pressable onPress={handleSettings} className="px-2">
              <Feather
                name="chevron-right"
                size={40}
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
      </View>
    </>
  );
}
