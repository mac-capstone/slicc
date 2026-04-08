import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { eventToCardData, GroupEventCard } from '@/components/group-event-card';
import { ActivityIndicator, colors, Text, View } from '@/components/ui';
import type { CategorizedEvents } from '@/lib/event-utils';
import { useRouter } from '@/lib/guarded-router';
import type { EventWithId } from '@/types';

type Props = {
  categorized: CategorizedEvents;
  isPending: boolean;
  isError: boolean;
  /** When false, the archived (past) events section is hidden. Default: true */
  showArchived?: boolean;
};

function EventList({
  events,
  onEventPress,
}: {
  events: EventWithId[];
  onEventPress: (eventId: string) => void;
}) {
  return (
    <View className="gap-2">
      {events.map((event) => (
        <GroupEventCard
          key={event.id}
          event={eventToCardData(event)}
          onPress={() => onEventPress(event.id)}
        />
      ))}
    </View>
  );
}

export function UpcomingEventsSection({
  categorized,
  isPending,
  isError,
  showArchived = true,
}: Props) {
  const router = useRouter();
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);

  const { current, upcoming, past } = categorized;
  const hasAnyEvents =
    current.length > 0 ||
    upcoming.length > 0 ||
    (showArchived && past.length > 0);

  const handleEventPress = useCallback(
    (eventId: string) => {
      router.push(`/event/${eventId}`);
    },
    [router]
  );

  if (isPending) {
    return (
      <View className="py-4">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="py-4">
        <Text className="text-center" style={{ color: colors.text[800] }}>
          Error loading events
        </Text>
      </View>
    );
  }

  if (!hasAnyEvents) {
    return (
      <View className="gap-3">
        <Text className="font-futuraDemi text-lg">Events</Text>
        <Text className="py-4 text-center" style={{ color: colors.text[800] }}>
          No events
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {current.length > 0 && (
        <View className="gap-2">
          <Text className="font-futuraDemi text-lg">Happening Now</Text>
          <EventList events={current} onEventPress={handleEventPress} />
        </View>
      )}

      {upcoming.length > 0 && (
        <View className="gap-2">
          <Text className="font-futuraDemi text-lg">Upcoming Events</Text>
          <EventList events={upcoming} onEventPress={handleEventPress} />
        </View>
      )}

      {showArchived && past.length > 0 && (
        <View className="gap-2">
          <Pressable
            onPress={() => setIsArchivedExpanded((prev) => !prev)}
            className="flex-row items-center justify-between py-1"
            accessibilityRole="button"
            accessibilityLabel={
              isArchivedExpanded
                ? 'Collapse archived events'
                : `Expand archived events (${past.length})`
            }
          >
            <Text className="font-futuraDemi text-lg">
              Archived ({past.length})
            </Text>
            <Ionicons
              name={isArchivedExpanded ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={colors.text[800]}
            />
          </Pressable>
          {isArchivedExpanded && (
            <EventList events={past} onEventPress={handleEventPress} />
          )}
        </View>
      )}
    </View>
  );
}
