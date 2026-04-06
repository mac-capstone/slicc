import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Pressable, View } from 'react-native';

import { StackedAvatars } from '@/components/stacked-avatars';
import { colors, Text } from '@/components/ui';
import type { EventIdT, EventWithId, UserIdT } from '@/types';

export type GroupEventCardData = {
  id: string;
  name: string;
  startDate: string;
  startTime: string;
  location?: string;
  participants: UserIdT[];
};

export function eventToCardData(event: EventWithId): GroupEventCardData {
  const startDate =
    event.startDate instanceof Date
      ? event.startDate
      : new Date(event.startDate);
  return {
    id: event.id,
    name: event.name,
    startDate: startDate.toISOString(),
    startTime: startDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    location: event.location,
    participants: event.participants as UserIdT[],
  };
}

function formatMonthDay(dateStr: string): { month: string; day: string } {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return { month: 'N/A', day: '0' };
  }
  const month = date
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase();
  const day = date.getDate().toString();
  return { month, day };
}

type Props = {
  event: GroupEventCardData;
  onPress: () => void;
  /** Event is in progress (between start and end). */
  isLive?: boolean;
  /** Tighter vertical spacing (e.g. in chat strip). */
  dense?: boolean;
};

export function GroupEventCard({ event, onPress, isLive, dense }: Props) {
  const { month, day } = formatMonthDay(event.startDate);
  const participantCount = event.participants.length;

  return (
    <Pressable
      onPress={onPress}
      className={dense ? 'mb-2' : 'mb-4'}
      accessibilityRole="button"
      accessibilityLabel={`View event ${event.name}`}
      accessibilityHint="Opens event details"
    >
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
          <View className="flex-row flex-wrap items-center gap-2">
            <Text
              className={`font-interSemiBold text-white ${dense ? 'text-xl' : 'text-2xl'}`}
              numberOfLines={1}
            >
              {event.name}
            </Text>
            {isLive ? (
              <View
                className="rounded px-1.5 py-0.5"
                style={{ backgroundColor: colors.accent[200] }}
              >
                <Text
                  className="text-[10px] font-bold uppercase"
                  style={{ color: colors.accent[100] }}
                >
                  LIVE
                </Text>
              </View>
            ) : null}
          </View>
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
          <StackedAvatars
            userIds={event.participants}
            eventId={event.id as EventIdT}
            avatarBorderClassName="border-2 border-neutral-850"
            suffixText={`${participantCount} people`}
          />
        </View>
      </View>
    </Pressable>
  );
}
