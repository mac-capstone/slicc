import { useQueries } from '@tanstack/react-query';
import React, { useCallback, useMemo } from 'react';
import { Pressable } from 'react-native';

import { fetchEvent } from '@/api/events/use-events';
import { fetchGroup } from '@/api/groups/use-groups';
import { GroupItem, type GroupItemData } from '@/components/group-item';
import { ActivityIndicator, colors, Text, View } from '@/components/ui';
import { formatCreationDate, formatEventDescription } from '@/lib/date-utils';
import { getMostRelevantEventId } from '@/lib/event-utils';
import { useGroupPreferences } from '@/lib/group-preferences';
import { useRouter } from '@/lib/guarded-router';
import type { EventIdT, EventWithId, GroupIdT, UserIdT } from '@/types';

export function PinnedGroupsSection() {
  const router = useRouter();
  const pinnedGroupIds = useGroupPreferences.use.pinnedGroupIds();
  const unreadGroupIds = useGroupPreferences.use.unreadGroupIds();
  const togglePin = useGroupPreferences.use.togglePin();

  const groupQueries = useQueries({
    queries: pinnedGroupIds.map((id) => ({
      queryKey: ['groups', 'groupId', id] as const,
      queryFn: () => fetchGroup(id as GroupIdT),
    })),
  });

  const groups = groupQueries
    .map((q) => q.data)
    .filter((g): g is NonNullable<typeof g> => g != null);

  const allEventIds = useMemo(
    () => [...new Set(groups.flatMap((g) => g.events))],
    [groups]
  );

  const eventQueries = useQueries({
    queries: allEventIds.map((id) => ({
      queryKey: ['events', 'eventId', id] as const,
      queryFn: () => fetchEvent(id as EventIdT),
    })),
  });

  const eventMap = useMemo(() => {
    const map = new Map<string, EventWithId>();
    allEventIds.forEach((id, i) => {
      const event = eventQueries[i]?.data;
      if (event) map.set(id, event);
    });
    return map;
  }, [allEventIds, eventQueries]);

  const groupsLoading = groupQueries.some((q) => q.isPending);
  const groupsFetchSettled = groupQueries.every((q) => !q.isPending);

  const groupItems = useMemo((): GroupItemData[] => {
    return groups.map((g) => {
      const primaryEventId =
        getMostRelevantEventId(g.events, eventMap) ?? undefined;
      const event = primaryEventId ? eventMap.get(primaryEventId) : undefined;
      const eventDescription = event
        ? formatEventDescription(event.name, event.startDate)
        : '';

      const hasUnread = unreadGroupIds.includes(g.id) && g.events.length > 0;

      return {
        id: g.id,
        title: g.name,
        hasUnreadIndicator: hasUnread,
        eventDescription,
        displayDate: formatCreationDate(g.createdAt),
        memberIds: g.members as UserIdT[],
        primaryEventId,
        isPinned: true,
      };
    });
  }, [groups, eventMap, unreadGroupIds]);

  const handlePinToggle = useCallback(
    (groupId: string) => {
      togglePin(groupId);
    },
    [togglePin]
  );

  if (pinnedGroupIds.length === 0) {
    return (
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="font-futuraDemi text-lg">Pinned Groups</Text>
          <Pressable
            onPress={() => router.push('/social')}
            accessibilityLabel="Open Social"
            accessibilityRole="button"
          >
            <Text className="text-sm" style={{ color: colors.accent[100] }}>
              See all
            </Text>
          </Pressable>
        </View>
        <Text className="py-4 text-center" style={{ color: colors.text[800] }}>
          No pinned groups. Swipe left on a group in the Groups tab to pin it.
        </Text>
      </View>
    );
  }

  if (groupsLoading) {
    return (
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="font-futuraDemi text-lg">Pinned Groups</Text>
          <Pressable
            onPress={() => router.push('/social')}
            accessibilityLabel="Open Social"
            accessibilityRole="button"
          >
            <Text className="text-sm" style={{ color: colors.accent[100] }}>
              See all
            </Text>
          </Pressable>
        </View>
        <View className="py-4">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (pinnedGroupIds.length > 0 && groups.length === 0 && groupsFetchSettled) {
    const firstError = groupQueries.find((q) => q.isError)?.error;
    const errorMessage =
      firstError instanceof Error
        ? firstError.message
        : 'Error loading pinned groups';

    return (
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="font-futuraDemi text-lg">Pinned Groups</Text>
          <Pressable
            onPress={() => router.push('/social')}
            accessibilityLabel="Open Social"
            accessibilityRole="button"
          >
            <Text className="text-sm" style={{ color: colors.accent[100] }}>
              See all
            </Text>
          </Pressable>
        </View>
        <Text className="py-4 text-center" style={{ color: colors.text[800] }}>
          {errorMessage}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-futuraDemi text-lg">Pinned Groups</Text>
        <Pressable
          onPress={() => router.push('/social')}
          accessibilityLabel="Open Social"
          accessibilityRole="button"
        >
          <Text className="text-sm" style={{ color: colors.accent[100] }}>
            See all
          </Text>
        </Pressable>
      </View>
      <View className="gap-0">
        {groupItems.map((item) => (
          <GroupItem key={item.id} group={item} onPinToggle={handlePinToggle} />
        ))}
      </View>
    </View>
  );
}
