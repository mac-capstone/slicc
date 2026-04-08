import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { ActivityIndicator, Linking, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEvent } from '@/api/events/use-events';
import { PersonAvatar } from '@/components/person-avatar';
import { Button, colors, Pressable, Text, View } from '@/components/ui';
import { router, Stack, useLocalSearchParams } from '@/lib/guarded-router';
import { useThemeConfig } from '@/lib/use-theme-config';
import type { EventIdT, UserIdT } from '@/types';

const avatarColorKeys = Object.keys(
  colors.avatar ?? {}
) as (keyof typeof colors.avatar)[];

// Helper function to format time in AM/PM format from Timestamp
const formatTimeAmPm = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Helper function to format date from Timestamp
const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
};

// Helper function to format date short (for "until" display)
const formatDateShort = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
};

// Helper function to get recurring text with calendar day
const getRecurringText = ({
  isRecurring,
  startDate,
  interval,
  unit,
  recurringEndDate,
}: {
  isRecurring: boolean;
  startDate: Date;
  interval?: number;
  unit?: string;
  recurringEndDate?: Date;
}): string => {
  if (!isRecurring) return '';

  const startDateObj = startDate;
  const repeatInterval = interval ?? 1;

  const unitText =
    unit === 'year'
      ? 'year'
      : unit === 'month'
        ? 'month'
        : unit === 'week'
          ? 'week'
          : 'day';

  let baseText = '';
  if (repeatInterval === 1) {
    baseText = `Repeats every ${unitText}`;
  } else {
    baseText = `Repeats every ${repeatInterval} ${unitText}s`;
  }

  // Add specific day information
  let dayInfo = '';
  if (unit === 'week') {
    const dayName = startDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
    });
    dayInfo = ` on ${dayName}`;
  } else if (unit === 'month') {
    const dayOfMonth = startDateObj.getDate();
    const suffix = getDaySuffix(dayOfMonth);
    dayInfo = ` on the ${dayOfMonth}${suffix}`;
  } else if (unit === 'year') {
    const monthDay = startDateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });
    dayInfo = ` on ${monthDay}`;
  }

  // Add "until" information if end date exists
  let untilText = '';
  if (recurringEndDate) {
    untilText = ` until ${formatDateShort(recurringEndDate)}`;
  }

  return baseText + dayInfo + untilText;
};

// Helper function to get ordinal suffix for day
const getDaySuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

export const areDatesEqual = (date1: Date, date2: Date): boolean =>
  date1.getTime() === date2.getTime();

function ViewExpensesFooter({
  eventId,
  bottom,
}: {
  eventId: string;
  bottom: number;
}) {
  return (
    <View
      className="border-t border-neutral-800 bg-background-950 p-4"
      style={{ paddingBottom: bottom + 16 }}
    >
      <Pressable
        onPress={() => router.push(`/event/${eventId}/expenses`)}
        className="flex-row items-center justify-between rounded-xl bg-neutral-850 p-4"
      >
        <Text className="text-base font-semibold text-white">
          View Expenses
        </Text>
        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function EventDetails() {
  const { bottom } = useSafeAreaInsets();
  const theme = useThemeConfig();
  const params = useLocalSearchParams<{ id: EventIdT }>();
  const eventId = params.id;

  const {
    data: event,
    isPending,
    isError,
  } = useEvent({
    variables: eventId as EventIdT,
    enabled: !!eventId,
  });

  const handleOpenGoogleMaps = async () => {
    if (!event?.location) return;
    const query = encodeURIComponent(event.location);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    try {
      await Linking.openURL(url);
    } catch {
      // Silently fail if can't open maps
      return;
    }
  };

  const handleEdit = () => {
    router.push(`/event/edit-event?id=${eventId}`);
  };

  const handleClose = (): void => {
    router.back();
  };

  const handleHeaderClose = (): void => {
    if (event?.groupId) {
      router.dismissTo(`/chat/${event.groupId}` as const);
      return;
    }
    router.back();
  };

  if (!eventId) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950 p-4">
        <Text className="mb-4 text-lg text-red-500">Missing event id</Text>
        <Button label="Go Back" onPress={handleClose} />
      </View>
    );
  }

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError || !event) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950 p-4">
        <Text className="mb-4 text-lg text-red-500">Error loading event</Text>
        <Button label="Go Back" onPress={handleClose} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.dark ? '#1A1A1A' : '#fff',
          },
          headerTintColor: theme.dark ? '#fff' : '#000',
          headerLeft: () => (
            <Pressable onPress={handleHeaderClose} className="px-2">
              <Ionicons
                name="close"
                size={28}
                color={theme.dark ? '#fff' : '#000'}
              />
            </Pressable>
          ),
        }}
      />
      <View className="flex-1 bg-background-950">
        <ScrollView className="flex-1">
          <View className="p-6">
            {/* Event Title and Edit Button */}
            <View className="mb-8 flex-row items-center justify-between">
              <Text className="flex-1 text-3xl font-bold text-white">
                {event.name}
              </Text>
              <Pressable onPress={handleEdit} className="ml-2 p-2">
                <Ionicons
                  name="create-outline"
                  size={24}
                  color={theme.dark ? '#fff' : '#000'}
                />
              </Pressable>
            </View>

            {/* Event Details Card */}
            <View className="rounded-2xl bg-neutral-850 p-5">
              {/* Date Section */}
              <View className="mb-4 flex-row items-start">
                <View className="mr-3 size-10 items-center justify-center rounded-xl bg-neutral-750">
                  <Ionicons name="calendar-outline" size={24} color="#00C8B3" />
                </View>
                <View className="flex-1">
                  {areDatesEqual(event.startDate, event.endDate) ? (
                    <Text className="text-base font-medium text-white">
                      {formatDate(event.startDate)}
                    </Text>
                  ) : (
                    <>
                      <View className="mb-2 flex-row items-baseline">
                        <Text className="w-12 text-base !text-gray-400">
                          Start
                        </Text>
                        <Text className="flex-1 text-base font-medium text-text-800">
                          {formatDate(event.startDate)}
                        </Text>
                      </View>
                      <View className="flex-row items-baseline">
                        <Text className="w-12 text-base !text-gray-400">
                          End
                        </Text>
                        <Text className="flex-1 text-base font-medium text-text-800">
                          {formatDate(event.endDate)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Divider */}
              <View className="mb-4 mt-0 h-px bg-gray-500" />

              {/* Time Section */}
              <View className="mb-4 flex-row items-start">
                <View className="mr-3 size-10 items-center justify-center rounded-xl bg-neutral-750">
                  <Ionicons name="time-outline" size={24} color="#00C8B3" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-white">
                    {formatTimeAmPm(event.startDate)} -{' '}
                    {formatTimeAmPm(event.endDate)}
                  </Text>
                  {event.isRecurring && (
                    <View className="mt-1 flex-row items-center">
                      <Ionicons
                        name="repeat"
                        size={14}
                        color="#A4A4A4"
                        style={{ marginRight: 4 }}
                      />
                      <Text className="text-sm text-text-800">
                        {getRecurringText({
                          isRecurring: event.isRecurring,
                          startDate: event.startDate,
                          interval: event.recurringInterval,
                          unit: event.recurringUnit,
                          recurringEndDate: event.recurringEndDate,
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Divider */}
              <View className="mb-4 mt-0 h-px bg-gray-500" />

              {/* People Section */}
              <View className="mb-4 flex-row items-start">
                <View className="mr-3 size-10 items-center justify-center rounded-xl bg-neutral-750">
                  <Ionicons name="people-outline" size={24} color="#00C8B3" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    {/* Display participant avatars */}
                    <View className="flex-row">
                      {event.participants.slice(0, 3).map((userId, index) => (
                        <View
                          key={userId}
                          style={{
                            marginLeft: index > 0 ? -8 : 0,
                            zIndex: event.participants.length - index,
                          }}
                        >
                          <PersonAvatar
                            userId={userId as UserIdT}
                            color={
                              avatarColorKeys[index % avatarColorKeys.length]
                            }
                            size="md"
                          />
                        </View>
                      ))}
                      {event.participants.length > 3 && (
                        <View
                          className="size-8 items-center justify-center rounded-full bg-neutral-750"
                          style={{
                            marginLeft: -8,
                            zIndex: 0,
                          }}
                        >
                          <Text className="text-xs font-semibold text-white">
                            +{event.participants.length - 3}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="ml-3 text-base font-medium text-white">
                      {event.participants.length} people
                    </Text>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View className="mb-4 mt-0 h-px bg-gray-500" />

              {/* Location Section */}
              {event.location && (
                <>
                  <View className="mb-4 flex-row items-start">
                    <View className="mr-3 size-10 items-center justify-center rounded-xl bg-neutral-750">
                      <Ionicons
                        name="location-outline"
                        size={24}
                        color="#00C8B3"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="mb-1 text-base font-medium text-white">
                        {event.location}
                      </Text>
                      <Pressable
                        onPress={handleOpenGoogleMaps}
                        className="flex-row items-center"
                      >
                        <Text className="text-sm font-semibold text-text-800">
                          Open in Google Maps
                        </Text>
                        <MaterialCommunityIcons
                          name="open-in-new"
                          size={16}
                          color="#00C8B3"
                          style={{ marginLeft: 4 }}
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* Divider */}
                  {event.details && (
                    <View className="mb-4 mt-0 h-px bg-gray-500" />
                  )}
                </>
              )}

              {/* Divider (if no location but has details) */}
              {!event.location && event.details && (
                <View className="mb-4 mt-0 h-px bg-gray-500" />
              )}

              {/* Details Section */}
              {event.details && (
                <View className="mb-0">
                  <Text className="mb-2 text-base font-semibold text-text-800">
                    Details
                  </Text>
                  <Text className="text-sm leading-5 text-text-50">
                    {event.details}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <ViewExpensesFooter eventId={eventId} bottom={bottom} />
      </View>
    </>
  );
}
