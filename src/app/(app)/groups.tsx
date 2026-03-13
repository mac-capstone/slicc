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
import { useGroupPreferences } from '@/lib/group-preferences';
import type { EventIdT, EventWithId, UserIdT } from '@/types';

function formatCreationDate(dateInput: Date | string | undefined): string {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Created yesterday';
  }
  return `Created ${date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })}`;
}

function formatEventWhen(startDate: Date | string): string {
  const eventDate = startDate instanceof Date ? startDate : new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays >= 2 && diffDays <= 6) return `in ${diffDays} days`;
  if (diffDays > 0 && eventDate.getMonth() !== today.getMonth())
    return 'next month';
  if (diffDays >= 7 && diffDays <= 13) return 'next week';
  if (diffDays >= 14 && diffDays <= 20) return 'in 2 weeks';
  if (diffDays >= 21 && diffDays <= 27) return 'in 3 weeks';
  if (diffDays >= 28) return 'next month';
  if (diffDays >= -7 && diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return eventDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatEventDescription(
  eventName: string,
  startDate: Date | string
): string {
  const when = formatEventWhen(startDate);
  return `${eventName} ${when}`;
}

function getMostUpcomingEventId(
  eventIds: string[],
  eventMap: Map<string, EventWithId>
): string | null {
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
        const primaryEventId = (getMostUpcomingEventId(g.events, eventMap) ??
          g.events[0]) as EventIdT | undefined;
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
          primaryEventId: (primaryEventId ?? g.id) as unknown as EventIdT,
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
