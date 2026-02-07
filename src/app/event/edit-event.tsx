/* eslint-disable max-lines-per-function */
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Switch,
} from 'react-native';

import { useEvent, useUpdateEvent } from '@/api/events/use-events';
import { useUsersAsPeople } from '@/api/people/use-users';
import { DateTimePick } from '@/components/date-time-pick';
import { Button, Input, Pressable, Text, View } from '@/components/ui';
import { useThemeConfig } from '@/lib/use-theme-config';
import type { EventIdT } from '@/types';

export default function EditEvent() {
  const theme = useThemeConfig();
  const params = useLocalSearchParams<{ id: EventIdT }>();
  const eventId = (params.id || 'event_birthday') as EventIdT;

  // Fetch event data
  const { data: event, isPending, isError } = useEvent({ variables: eventId });
  const updateEvent = useUpdateEvent();

  // Event form state
  const [eventName, setEventName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('1');
  const [recurringUnit, setRecurringUnit] = useState<
    'day' | 'week' | 'month' | 'year'
  >('day');
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(
    undefined
  );
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');

  // Initialize form with event data
  useEffect(() => {
    if (event) {
      setEventName(event.name);
      setStartDate(new Date(event.startDate));
      setEndDate(new Date(event.endDate));
      // Parse time strings to Date objects
      const startTimeDate = parseTimeToDate(event.startTime);
      const endTimeDate = parseTimeToDate(event.endTime);
      setStartTime(startTimeDate);
      setEndTime(endTimeDate);
      setIsRecurring(event.isRecurring);
      setRecurringInterval(event.recurringInterval?.toString() || '1');
      setRecurringUnit(event.recurringUnit || 'day');
      if (event.recurringEndDate) {
        setRecurringEndDate(new Date(event.recurringEndDate));
      }
      setLocation(event.location || '');
      setDetails(event.details || '');
    }
  }, [event]);

  // Participants - using users API
  // Color palette for participants
  const colors = [
    '#FF6B6B',
    '#FFD93D',
    '#6BCB77',
    '#4ECDC4',
    '#95E1D3',
    '#F38181',
  ];

  const { people: participants } = useUsersAsPeople(
    event?.participants || [],
    colors
  );

  const handleSaveChanges = async () => {
    try {
      await updateEvent.mutateAsync({
        eventId,
        data: {
          name: eventName,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          startTime: dateToTimeString(startTime),
          endTime: dateToTimeString(endTime),
          isRecurring,
          recurringInterval: isRecurring
            ? parseInt(recurringInterval)
            : undefined,
          recurringUnit: isRecurring ? recurringUnit : undefined,
          recurringEndDate:
            isRecurring && recurringEndDate
              ? recurringEndDate.toISOString().split('T')[0]
              : undefined,
          location,
          details,
          groupId: event?.groupId || ('group_default' as any),
          createdBy: event?.createdBy || ('user_default' as any),
          participants: event?.participants || [],
        },
      });

      Alert.alert('Success', 'Event updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to update event. Please try again.');
      console.error('Error updating event:', error);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Editing', 'Are you sure you want to discard changes?', [
      { text: 'Continue Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const handleAddPerson = () => {
    // TODO: Navigate to add person screen
    Alert.alert('Add Person', 'This feature will be implemented soon');
  };

  const handleOpenGoogleMaps = () => {
    const query = encodeURIComponent(location);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url);
  };

  const handleRecurringUnitPress = () => {
    const units: ('day' | 'week' | 'month' | 'year')[] = [
      'day',
      'week',
      'month',
      'year',
    ];
    const currentIndex = units.indexOf(recurringUnit);
    const nextIndex = (currentIndex + 1) % units.length;
    setRecurringUnit(units[nextIndex]);
  };

  const getRecurringUnitLabel = () => {
    const labels = {
      day: 'day(s)',
      week: 'week(s)',
      month: 'month(s)',
      year: 'year(s)',
    };
    return labels[recurringUnit];
  };
  const parseTimeToDate = (timeString: string): Date => {
    // Parse time string (HH:MM) to Date object
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const dateToTimeString = (date: Date): string => {
    // Convert Date object to time string (HH:MM)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  if (isPending) {
    return (
      <View className="bg-background-50 flex-1 items-center justify-center dark:bg-black">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError || !event) {
    return (
      <View className="bg-background-50 flex-1 items-center justify-center p-4 dark:bg-black">
        <Text className="mb-4 text-lg text-red-500">Error loading event</Text>
        <Button label="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Event',
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.dark ? '#000' : '#fff',
          },
          headerTintColor: theme.dark ? '#fff' : '#000',
          headerLeft: () => (
            <Pressable onPress={handleCancel} className="px-2">
              <Ionicons
                name="close"
                size={28}
                color={theme.dark ? '#fff' : '#000'}
              />
            </Pressable>
          ),
        }}
      />
      <ScrollView className="bg-background-50 flex-1 dark:bg-black">
        <View className="flex-1 p-4">
          {/* Event Name */}
          <Input
            value={eventName}
            onChangeText={setEventName}
            placeholder="Event Name"
            inputClassName="!text-2xl font-bold"
            containerClassName="mb-6"
            raw
          />

          <View className="rounded-lg bg-neutral-800 p-4">
            {/* Date Section */}
            <View className="mb-4 flex-row items-center">
              <View className="mr-3 size-10 items-center justify-center rounded-lg bg-zinc-900">
                <Ionicons name="calendar-outline" size={24} color="#3EB489" />
              </View>
              <View className="flex-1">
                <View className="mb-2">
                  <DateTimePick
                    value={startDate}
                    onChange={setStartDate}
                    mode="date"
                    label="Start"
                  />
                </View>
                <View>
                  <DateTimePick
                    value={endDate}
                    onChange={setEndDate}
                    mode="date"
                    label="End"
                  />
                </View>
              </View>
            </View>

            {/* Time Section */}
            <View className="mb-4 flex-row items-center">
              <View className="mr-3 size-10 items-center justify-center rounded-lg bg-zinc-900">
                <Ionicons name="time-outline" size={24} color="#3EB489" />
              </View>
              <View className="flex-1 flex-row items-center">
                <DateTimePick
                  value={startTime}
                  onChange={setStartTime}
                  mode="time"
                />
                <Text className="text-text-500 mx-2 text-lg">to</Text>
                <DateTimePick
                  value={endTime}
                  onChange={setEndTime}
                  mode="time"
                />
              </View>
            </View>

            {/* Recurring Event Section */}
            <View className="mb-4">
              <View className="flex-row items-center">
                <View className="mr-3 size-10 items-center justify-center rounded-lg bg-zinc-900">
                  <Ionicons name="repeat" size={24} color="#3EB489" />
                </View>
                <View className="flex-1 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Text className="text-lg font-semibold dark:text-text-50">
                      Recurring Event
                    </Text>
                  </View>
                  <Switch
                    value={isRecurring}
                    onValueChange={setIsRecurring}
                    trackColor={{ false: '#767577', true: '#3EB489' }}
                    thumbColor={isRecurring ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </View>

              {isRecurring && (
                <View className="ml-[46px] mt-3">
                  <View className="flex-row items-center">
                    <Text className="text-text-500 text-base">
                      Repeat every
                    </Text>
                    <Input
                      value={recurringInterval}
                      onChangeText={setRecurringInterval}
                      keyboardType="numeric"
                      inputClassName="w-8"
                      containerClassName="mx-2 my-2 items-center"
                      raw
                    />
                    <Pressable
                      onPress={handleRecurringUnitPress}
                      className="flex-row items-center"
                    >
                      <Text className="text-text-500 text-base">
                        {getRecurringUnitLabel()}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={theme.dark ? '#3EB489' : '#000'}
                        style={{ marginLeft: 4 }}
                      />
                    </Pressable>
                  </View>
                  <View className="mt-2">
                    <DateTimePick
                      value={recurringEndDate || new Date()}
                      onChange={setRecurringEndDate}
                      mode="date"
                      label="End Date (Optional)"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Divider */}
            <View className="my-4 h-px bg-gray-500" />

            {/* People Section */}
            <View className="mb-4">
              <View className="mb-3 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="mr-3 size-10 items-center justify-center rounded-lg bg-zinc-900">
                    <Ionicons name="people-outline" size={24} color="#3EB489" />
                  </View>
                  <Text className="text-lg font-semibold dark:text-text-50">
                    {participants.length} people
                  </Text>
                </View>
                <Pressable
                  onPress={handleAddPerson}
                  className="flex-row items-center rounded bg-zinc-900 px-2 py-1"
                >
                  <Ionicons name="person-add" size={18} color="#3EB489" />
                  <Text className="ml-1 text-base font-semibold text-accent-100">
                    Add
                  </Text>
                </Pressable>
              </View>

              <View className="ml-0">
                {participants.map((participant) => (
                  <View
                    key={participant.id}
                    className="mb-3 flex-row items-center"
                  >
                    <View
                      className="mr-3 size-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: participant.color }}
                    >
                      <Text className="text-lg font-bold text-white">
                        {participant.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </Text>
                    </View>
                    <Text className="text-lg dark:text-text-50">
                      {participant.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Location Section */}
            <View className="mb-4 flex-row items-center">
              <View className="mr-3 size-10 items-center justify-center rounded-lg bg-zinc-900">
                <Ionicons name="location-outline" size={24} color="#3EB489" />
              </View>
              <View className="flex-1">
                <Input
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Place Name"
                  inputClassName="bg-transparent"
                  containerClassName="mb-0"
                  raw
                />
                <Pressable
                  onPress={handleOpenGoogleMaps}
                  className="mt-0 flex-row items-center"
                >
                  <Text className="text-base font-semibold text-accent-100">
                    Open in Google Maps
                  </Text>
                  <MaterialCommunityIcons
                    name="open-in-new"
                    size={16}
                    color="#3EB489"
                    style={{ marginLeft: 4 }}
                  />
                </Pressable>
              </View>
            </View>

            {/* Divider */}
            <View className="my-4 h-px bg-gray-500" />

            {/* Details Section */}
            <View className="mb-0">
              <Text className="mb-2 text-xl font-semibold dark:text-text-50">
                Details
              </Text>
              <Input
                value={details}
                onChangeText={setDetails}
                placeholder="Enter event details..."
                multiline
                numberOfLines={4}
                inputClassName="min-h-2"
                containerClassName="mb-0"
                raw
              />
            </View>

            {/* Divider */}
            <View className="my-4 h-px bg-gray-500" />
          </View>

          {/* Action Buttons */}
          <View className="mt-6 flex-row gap-4">
            <Button
              label="Cancel"
              variant="outline"
              onPress={handleCancel}
              className="h-14 flex-1 border-2 !border-red-500"
            />
            <Button
              label="Save Changes"
              onPress={handleSaveChanges}
              className="h-14 flex-1"
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}
