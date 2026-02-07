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
  const params = useLocalSearchParams<{ id?: EventIdT }>();
  const eventId = params.id;

  const {
    data: event,
    isPending,
    isError,
  } = useEvent({
    variables: eventId as EventIdT,
    enabled: !!eventId,
  });

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

  // Helper functions
  const parseTimeToDate = (timeString: string): Date => {
    // Parse time string (HH:MM) to Date object
    const date = new Date();
    if (!timeString || !timeString.includes(':')) {
      return date; // Return current time as fallback
    }
    const [hours, minutes] = timeString.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return date;
    }
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const dateToTimeString = (date: Date): string => {
    // Convert Date object to time string (HH:MM)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const toLocalDateString = (date: Date): string => {
    // Convert Date to YYYY-MM-DD in local timezone
    return date.toLocaleDateString('en-CA'); // en-CA format is YYYY-MM-DD
  };

  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Initialize form with event data
  useEffect(() => {
    if (event) {
      setEventName(event.name);
      setStartDate(parseLocalDate(event.startDate));
      setEndDate(parseLocalDate(event.endDate));
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

  // Validation handlers
  const handleStartDateChange = (date: Date) => {
    if (date > endDate) {
      Alert.alert('Invalid Date', 'Start date cannot be after end date.');
      return;
    }
    setStartDate(date);
  };

  const handleEndDateChange = (date: Date) => {
    if (date < startDate) {
      Alert.alert('Invalid Date', 'End date cannot be before start date.');
      return;
    }
    setEndDate(date);
  };

  const handleStartTimeChange = (time: Date) => {
    if (startDate.toDateString() === endDate.toDateString() && time > endTime) {
      Alert.alert(
        'Invalid Time',
        'Start time must be before end time on the same day.'
      );
      return;
    }
    setStartTime(time);
  };

  const handleEndTimeChange = (time: Date) => {
    if (
      startDate.toDateString() === endDate.toDateString() &&
      time < startTime
    ) {
      Alert.alert(
        'Invalid Time',
        'End time must be after start time on the same day.'
      );
      return;
    }
    setEndTime(time);
  };

  const handleRecurringEndDateChange = (date: Date | undefined) => {
    if (date && date < startDate) {
      Alert.alert(
        'Invalid Date',
        'Recurring end date cannot be before start date.'
      );
      return;
    }
    setRecurringEndDate(date);
  };

  const handleSaveChanges = async () => {
    // Validate dates
    if (startDate > endDate) {
      Alert.alert('Invalid Dates', 'Start date must be before end date.');
      return;
    }

    // Validate recurring end date
    if (isRecurring && recurringEndDate && recurringEndDate < startDate) {
      Alert.alert(
        'Invalid Recurring End Date',
        'Recurring end date must be after start date.'
      );
      return;
    }

    // Validate times (only if start and end dates are the same)
    if (
      startDate.toDateString() === endDate.toDateString() &&
      startTime >= endTime
    ) {
      Alert.alert(
        'Invalid Times',
        'Start time must be before end time when dates are the same.'
      );
      return;
    }

    // Validate recurring interval
    const interval = isRecurring ? Number(recurringInterval) : undefined;
    if (
      isRecurring &&
      (!Number.isInteger(interval) || (interval as number) <= 0)
    ) {
      Alert.alert(
        'Invalid Interval',
        'Recurring interval must be a positive number.'
      );
      return;
    }

    try {
      await updateEvent.mutateAsync({
        eventId: eventId!,
        data: {
          name: eventName,
          startDate: toLocalDateString(startDate),
          endDate: toLocalDateString(endDate),
          startTime: dateToTimeString(startTime),
          endTime: dateToTimeString(endTime),
          isRecurring,
          recurringInterval: isRecurring ? (interval as number) : undefined,
          recurringUnit: isRecurring ? recurringUnit : undefined,
          recurringEndDate:
            isRecurring && recurringEndDate
              ? toLocalDateString(recurringEndDate)
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

  const handleOpenGoogleMaps = async () => {
    if (!location.trim()) {
      Alert.alert('Missing Location', 'Please enter a location first.');
      return;
    }
    const query = encodeURIComponent(location);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Cannot Open Maps', 'No app available to open this link.');
      return;
    }
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

  if (!eventId) {
    return (
      <View className="bg-background-50 flex-1 items-center justify-center p-4 dark:bg-black">
        <Text className="mb-4 text-lg text-red-500">Missing event id</Text>
        <Button label="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

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
                    onChange={handleStartDateChange}
                    mode="date"
                    label="Start"
                  />
                </View>
                <View>
                  <DateTimePick
                    value={endDate}
                    onChange={handleEndDateChange}
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
                  onChange={handleStartTimeChange}
                  mode="time"
                />
                <Text className="text-text-500 mx-2 text-lg">to</Text>
                <DateTimePick
                  value={endTime}
                  onChange={handleEndTimeChange}
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
                      onChange={handleRecurringEndDateChange}
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
