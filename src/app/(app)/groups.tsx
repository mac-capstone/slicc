import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { GroupItem, type GroupItemData } from '@/components/group-item';
import { colors, Text } from '@/components/ui';
import { mockData } from '@/lib/mock-data';
import type { EventIdT, UserIdT } from '@/types';

function formatCreationDate(dateStr: string): string {
  const date = new Date(dateStr);
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

function formatEventWhen(startDate: string): string {
  const eventDate = new Date(startDate);
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

function formatEventDescription(eventName: string, startDate: string): string {
  const when = formatEventWhen(startDate);
  return `${eventName} ${when}`;
}

function getMostUpcomingEventId(eventIds: string[]): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = eventIds
    .map((id) => mockData.events.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => e != null);

  const futureOrToday = events
    .filter((e) => new Date(e.doc.startDate).getTime() >= today.getTime())
    .sort(
      (a, b) =>
        new Date(a.doc.startDate).getTime() -
        new Date(b.doc.startDate).getTime()
    );

  if (futureOrToday.length > 0) {
    return futureOrToday[0].id;
  }

  const past = events.sort(
    (a, b) =>
      new Date(b.doc.startDate).getTime() - new Date(a.doc.startDate).getTime()
  );
  return past[0]?.id ?? null;
}

const PIN_LAYOUT_TRANSITION = LinearTransition.springify()
  .damping(40)
  .stiffness(200)
  .overshootClamping(200);

export default function Groups() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLayoutAnimationReady, setIsLayoutAnimationReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsLayoutAnimationReady(false);
      const id = setTimeout(() => setIsLayoutAnimationReady(true), 250);
      return () => clearTimeout(id);
    }, [])
  );

  const handlePinToggle = useCallback((groupId: string) => {
    const group = mockData.groups.find((g) => g.id === groupId);
    if (group) {
      group.doc.isPinned = !group.doc.isPinned;
      setRefreshKey((k) => k + 1);
    }
  }, []);

  const groups = useMemo((): GroupItemData[] => {
    const mapped = mockData.groups.map((g) => {
      const primaryEventId = (getMostUpcomingEventId(g.doc.eventIds) ??
        g.doc.eventIds[0]) as EventIdT;
      const event = mockData.events.find((e) => e.id === primaryEventId);
      const eventDescription = event
        ? formatEventDescription(event.doc.name, event.doc.startDate)
        : '';

      return {
        id: g.id,
        title: g.doc.title,
        hasUnreadIndicator: g.doc.hasUnreadIndicator,
        eventDescription,
        displayDate: formatCreationDate(g.doc.createdAt),
        memberIds: g.doc.memberIds as UserIdT[],
        primaryEventId,
        isPinned: g.doc.isPinned,
      };
    });
    return [...mapped].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  }, [refreshKey]);

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
        data={groups}
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
