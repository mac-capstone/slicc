import { useRouter } from 'expo-router';
import React from 'react';

import { eventToCardData, GroupEventCard } from '@/components/group-event-card';
import { ActivityIndicator, colors, Text, View } from '@/components/ui';
import type { EventWithId } from '@/types';

type Props = {
  events: EventWithId[];
  isPending: boolean;
  isError: boolean;
};

export function UpcomingEventsSection({ events, isPending, isError }: Props) {
  const router = useRouter();

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

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-futuraDemi text-lg">Upcoming Events</Text>
      </View>
      {events.length === 0 ? (
        <Text className="py-4 text-center" style={{ color: colors.text[800] }}>
          No upcoming events
        </Text>
      ) : (
        <View className="gap-2">
          {events.map((event) => (
            <GroupEventCard
              key={event.id}
              event={eventToCardData(event)}
              onPress={() => router.push(`/event/${event.id}`)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
