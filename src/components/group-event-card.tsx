import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Pressable, View } from 'react-native';

import { PersonAvatar } from '@/components/person-avatar';
import { colors, Text } from '@/components/ui';
import type { EventIdT, UserIdT } from '@/types';

export type GroupEventCardData = {
  id: string;
  name: string;
  startDate: string;
  startTime: string;
  location?: string;
  participants: UserIdT[];
};

function formatMonthDay(dateStr: string): { month: string; day: string } {
  const date = new Date(dateStr);
  const month = date
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase();
  const day = date.getDate().toString();
  return { month, day };
}

const VISIBLE_AVATAR_COUNT = 4;

type Props = {
  event: GroupEventCardData;
  onPress: () => void;
};

export function GroupEventCard({ event, onPress }: Props) {
  const { month, day } = formatMonthDay(event.startDate);
  const participantCount = event.participants.length;
  const visibleParticipants = event.participants.slice(0, VISIBLE_AVATAR_COUNT);
  const additionalCount = Math.max(0, participantCount - VISIBLE_AVATAR_COUNT);

  return (
    <Pressable onPress={onPress} className="mb-4">
      <View className="flex-row rounded-xl bg-neutral-850 p-4 shadow-xl">
        <View
          className="mr-3 size-14 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: colors.accent[200] }}
        >
          <Text
            className="font-interSemiBold text-lg leading-tight"
            style={{ color: colors.accent[100] }}
          >
            {month}
          </Text>
          <Text
            className="font-interSemiBold -mt-0.5 text-lg leading-tight"
            style={{ color: colors.accent[100] }}
          >
            {day}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className="font-interSemiBold text-2xl text-white"
            numberOfLines={1}
          >
            {event.name}
          </Text>
          <View className="mt-1 flex-row items-center gap-1">
            <Text className="text-sm" style={{ color: colors.text[800] }}>
              {event.startTime}
            </Text>
            {event.location && (
              <>
                <Text className="text-sm" style={{ color: colors.text[800] }}>
                  •
                </Text>
                <Feather
                  name="map-pin"
                  size={12}
                  color={colors.text[800]}
                  style={{ marginRight: 2 }}
                />
                <Text
                  className="flex-1 text-sm"
                  style={{ color: colors.text[800] }}
                  numberOfLines={1}
                >
                  {event.location}
                </Text>
              </>
            )}
          </View>
          <View className="mt-2 flex-row items-center">
            {visibleParticipants.map((userId, index) => (
              <View
                key={userId}
                className="rounded-full border-2 border-neutral-850"
                style={index > 0 ? { marginLeft: -8 } : undefined}
              >
                <PersonAvatar
                  userId={userId}
                  eventId={event.id as EventIdT}
                  size="sm"
                />
              </View>
            ))}
            {additionalCount > 0 && (
              <View
                className="size-6 items-center justify-center rounded-full border-2 border-background-950 bg-neutral-850"
                style={{ marginLeft: -8 }}
              >
                <Text className="text-xs font-medium text-neutral-900">
                  +{additionalCount}
                </Text>
              </View>
            )}
            <Text className="ml-2 text-sm" style={{ color: colors.text[800] }}>
              {participantCount} people
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
