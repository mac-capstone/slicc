/* eslint-disable max-lines-per-function */
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueries } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { deleteField, Timestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Switch,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import {
  useCreateEvent,
  useEvent,
  useUpdateEvent,
} from '@/api/events/use-events';
import { useGroup } from '@/api/groups/use-groups';
import { fetchUser, useUsersAsPeople } from '@/api/people/use-users';
import { DateTimePick } from '@/components/date-time-pick';
import { EventParticipantsSection } from '@/components/event-participants-section';
import { Button, Input, Pressable, Select, Text, View } from '@/components/ui';
import { getUserId } from '@/lib';
import { useThemeConfig } from '@/lib/use-theme-config';
import type { EventIdT, GroupIdT, UserIdT, UserWithId } from '@/types';

type RecurringUnit = 'day' | 'week' | 'month' | 'year';

function isRecurringUnit(value: string | number): value is RecurringUnit {
  return (
    value === 'day' || value === 'week' || value === 'month' || value === 'year'
  );
}

const recurringUnitOptions: { label: string; value: RecurringUnit }[] = [
  { label: 'day(s)', value: 'day' },
  { label: 'week(s)', value: 'week' },
  { label: 'month(s)', value: 'month' },
  { label: 'year(s)', value: 'year' },
];

const colorsvar = [
  '#FF6B6B',
  '#FFD93D',
  '#6BCB77',
  '#4ECDC4',
  '#95E1D3',
  '#F38181',
];

export default function EditEvent() {
  const theme = useThemeConfig();
  const params = useLocalSearchParams<{ id?: EventIdT; groupId?: GroupIdT }>();

  const [eventId] = useState<EventIdT>(
    () => (params.id || uuidv4()) as EventIdT
  );
  const groupId = params.groupId;
  const isEditMode = !!params.id;

  const {
    data: event,
    isPending,
    isError,
  } = useEvent({
    variables: eventId as EventIdT,
    enabled: !!params.id,
  });

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const [eventName, setEventName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('1');
  const [recurringUnit, setRecurringUnit] = useState<RecurringUnit>('day');
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(
    undefined
  );
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [participantIds, setParticipantIds] = useState<UserIdT[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (event) {
      setEventName(event.name);
      setStartDate(event.startDate);
      setEndDate(event.endDate);
      setIsRecurring(event.isRecurring ?? false);
      setRecurringInterval(event.recurringInterval?.toString() || '1');
      setRecurringUnit(event.recurringUnit || 'day');
      if (event.recurringEndDate) setRecurringEndDate(event.recurringEndDate);
      setLocation(event.location || '');
      setDetails(event.details || '');
      setParticipantIds((event.participants ?? []) as UserIdT[]);
    }
  }, [event]);

  // Fetch group to get its members as candidates
  const activeGroupId = groupId ?? (event?.groupId as GroupIdT | undefined);
  const { data: group } = useGroup({
    variables: activeGroupId!,
    enabled: !!activeGroupId,
  });
  const groupMemberIds = useMemo(() => {
    const groupIds = (group?.members ?? []) as UserIdT[];
    const eventParticipantIds = (event?.participants ?? []) as UserIdT[];
    const mergedIds = new Set<UserIdT>([...groupIds, ...eventParticipantIds]);
    return [...mergedIds];
  }, [group, event]);

  // Fetch group member user details for the picker
  const memberQueries = useQueries({
    queries: groupMemberIds.map((id) => ({
      queryKey: ['users', 'userId', id] as const,
      queryFn: () => fetchUser(id),
    })),
  });
  const groupMembers = useMemo(
    () =>
      memberQueries
        .map((q) => q.data)
        .filter((u): u is UserWithId => u != null),
    [memberQueries]
  );

  // Map participantIds to EventPerson for display
  const { people: participants } = useUsersAsPeople(participantIds, colorsvar);

  const dateToTimestamp = (date: Date): Timestamp => Timestamp.fromDate(date);

  const handleStartDateChange = (date: Date): void => {
    const newDate = new Date(date);
    newDate.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
    if (newDate > endDate) {
      Alert.alert(
        'Invalid Date',
        'Start date/time cannot be after end date/time.'
      );
      return;
    }
    setStartDate(newDate);
  };

  const handleEndDateChange = (date: Date): void => {
    const newDate = new Date(date);
    newDate.setHours(endDate.getHours(), endDate.getMinutes(), 0, 0);
    if (newDate < startDate) {
      Alert.alert(
        'Invalid Date',
        'End date/time cannot be before start date/time.'
      );
      return;
    }
    setEndDate(newDate);
  };

  const handleStartTimeChange = (time: Date): void => {
    const newDate = new Date(startDate);
    newDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
    if (newDate >= endDate) {
      Alert.alert(
        'Invalid Time',
        'Start date/time must be before end date/time.'
      );
      return;
    }
    setStartDate(newDate);
  };

  const handleEndTimeChange = (time: Date): void => {
    const newDate = new Date(endDate);
    newDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
    if (newDate <= startDate) {
      Alert.alert(
        'Invalid Time',
        'End date/time must be after start date/time.'
      );
      return;
    }
    setEndDate(newDate);
  };

  const handleRecurringEndDateChange = (date: Date | undefined): void => {
    if (date && date < startDate) {
      Alert.alert(
        'Invalid Date',
        'Recurring end date cannot be before start date.'
      );
      return;
    }
    setRecurringEndDate(date);
  };

  const handleSaveChanges = async (): Promise<void> => {
    if (startDate >= endDate) {
      Alert.alert(
        'Invalid Dates',
        'Start date/time must be before end date/time.'
      );
      return;
    }
    if (isRecurring && recurringEndDate && recurringEndDate < startDate) {
      Alert.alert(
        'Invalid Recurring End Date',
        'Recurring end date must be after start date.'
      );
      return;
    }
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
      if (isEditMode) {
        const updateData: any = {
          name: eventName,
          startDate: dateToTimestamp(startDate),
          endDate: dateToTimestamp(endDate),
          location,
          details,
          groupId: event!.groupId,
          createdBy: event!.createdBy,
          participants: participantIds,
        };
        if (isRecurring) {
          updateData.isRecurring = true;
          updateData.recurringInterval = interval as number;
          updateData.recurringUnit = recurringUnit;
          updateData.recurringEndDate = recurringEndDate
            ? dateToTimestamp(recurringEndDate)
            : deleteField();
        } else {
          updateData.isRecurring = false;
          updateData.recurringInterval = deleteField();
          updateData.recurringUnit = deleteField();
          updateData.recurringEndDate = deleteField();
        }
        await updateEvent.mutateAsync({ eventId: eventId!, data: updateData });
      } else {
        if (!groupId) {
          Alert.alert('Error', 'Group ID is required to create an event.');
          return;
        }
        const createData: any = {
          name: eventName,
          startDate: dateToTimestamp(startDate),
          endDate: dateToTimestamp(endDate),
          isRecurring,
          location,
          details,
          groupId: groupId as GroupIdT,
          createdBy: getUserId(),
          participants: participantIds,
        };
        if (isRecurring) {
          createData.recurringInterval = interval as number;
          createData.recurringUnit = recurringUnit;
          if (recurringEndDate)
            createData.recurringEndDate = dateToTimestamp(recurringEndDate);
        }
        await createEvent.mutateAsync({ eventId: eventId!, data: createData });
      }
      router.replace(`/event/${eventId}` as any);
    } catch (error) {
      Alert.alert(
        'Error',
        `Failed to ${isEditMode ? 'update' : 'create'} event. Please try again.`
      );
      console.error(
        `Error ${isEditMode ? 'updating' : 'creating'} event:`,
        error
      );
    }
  };

  const handleCancel = (): void => {
    Alert.alert(
      isEditMode ? 'Cancel Editing' : 'Cancel Creation',
      `Are you sure you want to discard ${isEditMode ? 'changes' : 'this event'}?`,
      [
        { text: isEditMode ? 'Continue Editing' : 'Continue', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  const handleOpenGoogleMaps = async (): Promise<void> => {
    if (!location.trim()) {
      Alert.alert('Missing Location', 'Please enter a location first.');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot Open Maps', 'No app available to open this link.');
    }
  };

  if (isEditMode && isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isEditMode && (isError || !event)) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950 p-4">
        <Text className="mb-4 text-lg text-red-500">Error loading event</Text>
        <Button label="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  if (!isEditMode && !groupId) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950 p-4">
        <Text className="mb-4 text-lg text-red-500">
          Group ID is required to create an event
        </Text>
        <Button label="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditMode ? 'Edit Event' : 'Create Event',
          headerShown: true,
          headerStyle: { backgroundColor: theme.dark ? '#1A1A1A' : '#fff' },
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
      <ScrollView className="flex-1 bg-background-950">
        <View className="flex-1 p-4">
          <Input
            value={eventName}
            onChangeText={setEventName}
            placeholder="Event Name"
            inputClassName="!text-3xl font-bold"
            containerClassName="mb-6"
          />

          <View className="rounded-xl bg-neutral-850 p-4">
            {/* Date Section */}
            <View className="mb-4 flex-row items-center">
              <View className="mr-3 size-10 items-center justify-center rounded-xl bg-neutral-750">
                <Ionicons name="calendar-outline" size={24} color="#00C8B3" />
              </View>
              <View className="flex-1">
                <View className="mb-2 flex-row items-baseline">
                  <Text className="w-12 text-base !text-gray-400">Start</Text>
                  <View className="flex-1">
                    <DateTimePick
                      value={startDate}
                      onChange={handleStartDateChange}
                      mode="date"
                    />
                  </View>
                </View>
                <View className="flex-row items-baseline">
                  <Text className="w-12 text-base !text-gray-400">End</Text>
                  <View className="flex-1">
                    <DateTimePick
                      value={endDate}
                      onChange={handleEndDateChange}
                      mode="date"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Time Section */}
            <View className="mb-4 flex-row items-center">
              <View className="mr-3 size-10 items-center justify-center rounded-xl bg-neutral-750">
                <Ionicons name="time-outline" size={24} color="#00C8B3" />
              </View>
              <View className="flex-1 flex-row items-center">
                <DateTimePick
                  value={startDate}
                  onChange={handleStartTimeChange}
                  mode="time"
                />
                <Text className="mx-2 text-sm text-text-800">to</Text>
                <DateTimePick
                  value={endDate}
                  onChange={handleEndTimeChange}
                  mode="time"
                />
              </View>
            </View>

            {/* Recurring Section */}
            <View className="mb-4">
              <View className="flex-row items-center">
                <View className="mr-3 size-10 items-center justify-center rounded-xl bg-neutral-750">
                  <Ionicons name="repeat" size={24} color="#00C8B3" />
                </View>
                <View className="flex-1 flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-white">
                    Recurring Event
                  </Text>
                  <Switch
                    value={isRecurring}
                    onValueChange={setIsRecurring}
                    trackColor={{ false: '#767577', true: '#00C8B3' }}
                    thumbColor={isRecurring ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </View>

              {isRecurring && (
                <View className="ml-[46px] mt-3">
                  <View className="flex-row items-center">
                    <Text className="text-sm text-text-800">Repeat every</Text>
                    <Input
                      value={recurringInterval}
                      onChangeText={setRecurringInterval}
                      keyboardType="numeric"
                      inputClassName="w-8"
                      containerClassName="mx-2 my-2 items-center"
                      raw
                    />
                    <View className="relative w-24">
                      <Select
                        value={recurringUnit}
                        options={recurringUnitOptions}
                        onSelect={(value) => {
                          if (isRecurringUnit(value)) setRecurringUnit(value);
                        }}
                        placeholder="Select unit"
                      />
                      <View className="pointer-events-none absolute right-1 top-1/2 -translate-y-2/3">
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color="#00C8B3"
                        />
                      </View>
                    </View>
                  </View>
                  <View className="mt-2">
                    <Text className="mb-1 text-sm text-text-800">
                      Recurring End Date (Optional)
                    </Text>
                    <View className="flex-row items-center">
                      {recurringEndDate ? (
                        <>
                          <DateTimePick
                            value={recurringEndDate}
                            onChange={handleRecurringEndDateChange}
                            mode="date"
                          />
                          <Pressable
                            onPress={() => setRecurringEndDate(undefined)}
                            className="ml-2 rounded-lg bg-neutral-750 p-2"
                          >
                            <Ionicons name="close" size={18} color="#FF6B6B" />
                          </Pressable>
                        </>
                      ) : (
                        <Pressable
                          onPress={() =>
                            handleRecurringEndDateChange(new Date(startDate))
                          }
                          className="rounded-lg bg-neutral-750 px-3 py-2"
                        >
                          <Text className="text-sm text-text-800">
                            Set End Date
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View className="my-4 h-px bg-gray-500" />

            {/* Participants Section */}
            <EventParticipantsSection
              participants={participants}
              showPicker={showPicker}
              groupMembers={groupMembers}
              selectedParticipantIds={participantIds}
              onAddPress={() => setShowPicker(true)}
              onPickerClose={() => setShowPicker(false)}
              onPickerConfirm={(ids) => {
                setParticipantIds(ids);
                setShowPicker(false);
              }}
            />

            {/* Location Section */}
            <View className="mb-4 flex-row items-center">
              <View className="mr-3 size-10 items-center justify-center rounded-xl bg-neutral-750">
                <Ionicons name="location-outline" size={24} color="#00C8B3" />
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

            <View className="my-4 h-px bg-gray-500" />

            {/* Details Section */}
            <View className="mb-0">
              <Text className="mb-2 text-lg font-semibold text-text-800">
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

            <View className="my-4 h-px bg-gray-500" />
          </View>
        </View>
      </ScrollView>

      <View className="m-6 flex-row gap-24">
        <Button
          label="Cancel"
          variant="outline"
          onPress={handleCancel}
          className="h-12 flex-1 border !border-red-500"
        />
        <Button
          label={isEditMode ? 'Save Changes' : 'Create Event'}
          onPress={handleSaveChanges}
          className="h-12 flex-1 border !border-text-800 !bg-background-950"
          textClassName="!text-white"
        />
      </View>
    </>
  );
}
