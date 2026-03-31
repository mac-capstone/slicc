import Feather from '@expo/vector-icons/Feather';
import Octicons from '@expo/vector-icons/Octicons';
import { router } from 'expo-router';
import * as React from 'react';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { eventToCardData, GroupEventCard } from '@/components/group-event-card';
import { colors, Text } from '@/components/ui';
import { categorizeEvents } from '@/lib/event-utils';
import type { EventWithId } from '@/types';

type Props = {
  events: EventWithId[];
  isPending: boolean;
};

export function ChatEventsCollapsible({ events, isPending }: Props) {
  const [expanded, setExpanded] = useState(true);

  const { current, upcoming } = useMemo(
    () => categorizeEvents(events),
    [events]
  );

  const happeningCount = current.length;
  const summaryLabel =
    happeningCount > 0
      ? `${happeningCount} happening now`
      : upcoming.length > 0
        ? `${upcoming.length} upcoming`
        : 'No upcoming events';

  if (isPending) {
    return (
      <View
        className="border-b border-charcoal-800 bg-charcoal-900 px-3 py-2"
        style={{ backgroundColor: colors.charcoal[900] }}
      >
        <Text className="text-sm text-charcoal-400">Loading events…</Text>
      </View>
    );
  }

  const visibleEvents = [...current, ...upcoming].slice(0, 8);

  return (
    <View
      className="border-b border-charcoal-800"
      style={{ backgroundColor: colors.charcoal[900] }}
    >
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        className="flex-row items-center justify-between px-3 py-2.5"
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse events' : 'Expand events'}
      >
        <View className="flex-row items-center gap-2">
          <Octicons name="calendar" size={18} color={colors.accent[100]} />
          <Text className="text-sm font-semibold text-white">
            {summaryLabel}
          </Text>
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.charcoal[300]}
        />
      </Pressable>

      {expanded && (
        <View className="px-3 pb-3">
          {visibleEvents.map((ev) => {
            const isLive = current.some((c) => c.id === ev.id);
            return (
              <GroupEventCard
                key={ev.id}
                event={eventToCardData(ev)}
                isLive={isLive}
                dense
                onPress={() => router.push(`/event/${ev.id}` as const)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
