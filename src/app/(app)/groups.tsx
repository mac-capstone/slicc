import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useQueries } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { fetchEvent } from '@/api/events/use-events';
import { fetchGroup, useGroupIds } from '@/api/groups/use-groups';
import { GroupItem, type GroupItemData } from '@/components/group-item';
import { colors, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatCreationDate, formatEventDescription } from '@/lib/date-utils';
import { useGroupPreferences } from '@/lib/group-preferences';
import type { EventIdT, EventWithId, UserIdT } from '@/types';

function getMostUpcomingEventId(
  eventIds: string[],
  eventMap: Map<string, EventWithId>
): EventIdT | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = eventIds
    .map((id) => eventMap.get(id))
    .filter((e): e is EventWithId => e != null);

  const futureOrToday = events
    .filter((e) => e.startDate.getTime() >= today.getTime())
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  if (futureOrToday.length > 0) {
    return futureOrToday[0].id;
  }

  const past = events.sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime()
  );
  return past[0]?.id ?? null;
}

const PIN_LAYOUT_TRANSITION = LinearTransition.springify()
  .damping(40)
  .stiffness(200)
  .overshootClamping(200);

export default function Groups() {
  const userId = useAuth.use.userId();
  const pinnedGroupIds = useGroupPreferences.use.pinnedGroupIds();
  const unreadGroupIds = useGroupPreferences.use.unreadGroupIds();
  const togglePin = useGroupPreferences.use.togglePin();
  const [isLayoutAnimationReady, setIsLayoutAnimationReady] = useState(false);

  const { data: groupIds = [] } = useGroupIds({
    variables: userId,
  });

  const groupQueries = useQueries({
    queries: groupIds.map((id) => ({
      queryKey: ['groups', 'groupId', id] as const,
      queryFn: () => fetchGroup(id),
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

  const handlePinToggle = useCallback(
    (groupId: string) => {
      togglePin(groupId);
    },
    [togglePin]
  );

  const groupItems = useMemo((): GroupItemData[] => {
    return groups
      .map((g) => {
        const primaryEventId =
          getMostUpcomingEventId(g.events, eventMap) ?? undefined;
        const event = primaryEventId ? eventMap.get(primaryEventId) : undefined;
        const eventDescription = event
          ? formatEventDescription(event.name, event.startDate)
          : '';

        const isPinned = pinnedGroupIds.includes(g.id);
        const hasUnread = unreadGroupIds.includes(g.id) && g.events.length > 0;

        return {
          id: g.id,
          title: g.name,
          hasUnreadIndicator: hasUnread,
          eventDescription,
          displayDate: formatCreationDate(g.createdAt),
          memberIds: g.members as UserIdT[],
          primaryEventId,
          isPinned,
        };
      })
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  }, [groups, eventMap, pinnedGroupIds, unreadGroupIds]);

  useFocusEffect(
    useCallback(() => {
      setIsLayoutAnimationReady(false);
      const id = setTimeout(() => setIsLayoutAnimationReady(true), 250);
      return () => clearTimeout(id);
    }, [])
  );

  return (
    <View className="flex-1 px-4">
      <Text
        className="py-2 text-center text-xs"
        style={{ color: colors.text[800] }}
      >
        Swipe left to pin
      </Text>
      <View className="border-b border-neutral-700" />
      <FlashList
        data={groupItems}
        renderItem={({ item }) => (
          <Animated.View
            layout={isLayoutAnimationReady ? PIN_LAYOUT_TRANSITION : undefined}
          >
            <GroupItem group={item} onPinToggle={handlePinToggle} />
          </Animated.View>
        )}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}
