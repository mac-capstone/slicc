import Feather from '@expo/vector-icons/Feather';
import { useQueries } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';

import { useEventsByGroupId } from '@/api/events/use-events';
import {
  useDeleteGroup,
  useGroup,
  useLeaveGroup,
  useUpdateGroup,
} from '@/api/groups/use-groups';
import { fetchUser } from '@/api/people/use-users';
import { useFriendUserIds } from '@/api/social/friendships';
import { eventToCardData, GroupEventCard } from '@/components/group-event-card';
import { MemberPickerModal } from '@/components/member-picker-modal';
import {
  PersonAvatar,
  personAvatarColorForIndex,
} from '@/components/person-avatar';
import { Button, colors, Pressable, SafeAreaView, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { categorizeEvents } from '@/lib/event-utils';
import type { GroupIdT, UserIdT, UserWithId } from '@/types';

const EMPTY_USER_IDS: UserIdT[] = [];

function GroupNameRow({
  groupTitle,
  setGroupTitle,
  isEditingName,
  setIsEditingName,
  nameInputRef,
}: {
  groupTitle: string;
  setGroupTitle: (v: string) => void;
  isEditingName: boolean;
  setIsEditingName: (v: boolean) => void;
  nameInputRef: React.RefObject<TextInput | null>;
}) {
  return (
    <View className="mb-8 items-center px-2">
      {isEditingName ? (
        <TextInput
          ref={nameInputRef}
          value={groupTitle}
          onChangeText={setGroupTitle}
          onBlur={() => setIsEditingName(false)}
          autoFocus
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#ffffff',
            padding: 0,
            textAlign: 'center',
            width: '100%',
          }}
        />
      ) : (
        <Pressable
          onPress={() => {
            setIsEditingName(true);
            setTimeout(() => nameInputRef.current?.focus(), 50);
          }}
          className="flex-row items-center justify-center gap-2"
        >
          <Text className="text-center text-2xl font-bold text-white">
            {groupTitle || 'Group name'}
          </Text>
          <Feather name="edit-2" size={18} color="#A4A4A4" />
        </Pressable>
      )}
    </View>
  );
}

export default function GroupMembersScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id as GroupIdT;
  const currentUserId = useAuth.use.userId() as UserIdT | null;

  const {
    data: group,
    isPending,
    isError,
  } = useGroup({
    variables: groupId,
  });

  const [groupTitle, setGroupTitle] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<UserIdT>>(
    () => new Set()
  );
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [eventsTab, setEventsTab] = useState<'upcoming' | 'past'>('upcoming');
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (group) {
      setGroupTitle(group.name);
      setSelectedMemberIds(new Set(group.members as UserIdT[]));
    }
  }, [group]);

  const { data: friendUserIds = [] } = useFriendUserIds({
    variables: currentUserId,
    enabled: !!currentUserId,
  });

  const friendUserQueries = useQueries({
    queries: friendUserIds.map((id) => ({
      queryKey: ['users', 'userId', id] as const,
      queryFn: () => fetchUser(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const friends = useMemo(
    () =>
      friendUserQueries
        .map((q) => q.data)
        .filter((u): u is UserWithId => u != null),
    [friendUserQueries]
  );

  const addMemberCandidates = useMemo(
    () => friends.filter((f) => !selectedMemberIds.has(f.id)),
    [friends, selectedMemberIds]
  );

  const memberIdList = useMemo(
    () => Array.from(selectedMemberIds),
    [selectedMemberIds]
  );

  const memberQueries = useQueries({
    queries: memberIdList.map((id) => ({
      queryKey: ['users', 'userId', id] as const,
      queryFn: () => fetchUser(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const memberRows = useMemo(() => {
    const rows = memberIdList.map((id, index) => {
      const user = memberQueries[index]?.data;
      return {
        id,
        displayName: user?.displayName ?? 'Unknown',
        isSelf: id === currentUserId,
      };
    });
    return rows.sort((a, b) => {
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [memberIdList, memberQueries, currentUserId]);

  const isGroupOwner = group != null && group.owner === currentUserId;

  const canRemoveMember = (memberId: UserIdT): boolean => {
    if (!currentUserId || memberId === currentUserId) return false;
    return isGroupOwner;
  };

  const removeMember = (uid: UserIdT): void => {
    if (!canRemoveMember(uid)) return;
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
  };

  const { data: events = [], isPending: eventsPending } = useEventsByGroupId({
    variables: groupId,
    enabled: Boolean(groupId) && Boolean(group),
  });

  const { upcoming, current, past } = useMemo(
    () => categorizeEvents(events),
    [events]
  );

  const upcomingTabEvents = useMemo(
    () => [...current, ...upcoming],
    [current, upcoming]
  );

  const updateGroup = useUpdateGroup();
  const leaveGroup = useLeaveGroup();
  const deleteGroup = useDeleteGroup();
  const isSaving = updateGroup.isPending;
  const isLeaving = leaveGroup.isPending;
  const isDeleting = deleteGroup.isPending;

  const handleSave = async (): Promise<void> => {
    if (!currentUserId || !group || isSaving) return;

    const members = Array.from(selectedMemberIds);
    if (!members.includes(currentUserId)) members.unshift(currentUserId);

    try {
      await updateGroup.mutateAsync({
        groupId,
        data: { name: groupTitle, members },
      });
    } catch (err) {
      console.error('Failed to save group:', err);
      Alert.alert('Error', 'Failed to save changes, please try again.');
    }
  };

  const handlePickerConfirm = (ids: UserIdT[]): void => {
    if (ids.length === 0) {
      setMemberPickerOpen(false);
      return;
    }
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    setMemberPickerOpen(false);
  };

  const handleLeaveGroup = async (): Promise<void> => {
    if (!currentUserId) return;

    try {
      await leaveGroup.mutateAsync({ groupId, userId: currentUserId });
      router.replace('/social');
    } catch (error) {
      console.error('Failed to leave group:', error);
      Alert.alert('Error', 'Failed to leave group, please try again.');
    }
  };

  const handleDeleteGroup = async (): Promise<void> => {
    if (!isGroupOwner) return;
    try {
      await deleteGroup.mutateAsync({ groupId });
      router.replace('/social');
    } catch (error) {
      console.error('Failed to delete group:', error);
      Alert.alert('Error', 'Failed to delete group, please try again.');
    }
  };

  const confirmDeleteGroup = (): void => {
    Alert.alert(
      'Delete group',
      'This removes the group for everyone. Event records may still exist.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void handleDeleteGroup(),
        },
      ]
    );
  };

  if (isPending || isError || !group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">
          {isPending ? 'Loading...' : 'Group not found'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-background-950">
        <View className="flex-row items-center px-4 pb-3">
          <Pressable onPress={() => router.back()} className="p-1">
            <Feather name="arrow-left" size={24} color="#ffffff" />
          </Pressable>
          <Text className="ml-2 text-xl font-semibold text-white">
            Group Info
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <GroupNameRow
            groupTitle={groupTitle}
            setGroupTitle={setGroupTitle}
            isEditingName={isEditingName}
            setIsEditingName={setIsEditingName}
            nameInputRef={nameInputRef}
          />

          <Text className="mb-3 text-sm text-neutral-400">
            {selectedMemberIds.size}{' '}
            {selectedMemberIds.size === 1 ? 'Member' : 'Members'}
          </Text>

          <View className="mb-2">
            {memberRows.map((row, listIndex) => (
              <View
                key={row.id}
                className="flex-row items-center border-b border-neutral-800 py-3"
              >
                <PersonAvatar
                  userId={row.id}
                  fallbackLabel={row.displayName}
                  size={36}
                  color={personAvatarColorForIndex(listIndex)}
                />
                <Text className="ml-3 flex-1 text-base text-white">
                  {row.isSelf ? 'You' : row.displayName}
                </Text>
                {canRemoveMember(row.id) ? (
                  <Pressable
                    onPress={() => removeMember(row.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${row.displayName}`}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: '#ef4444' }}
                    >
                      Remove
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => setMemberPickerOpen(true)}
            className="mb-6 flex-row items-center py-3"
            accessibilityRole="button"
            accessibilityLabel="Add member"
          >
            <View className="mr-3 size-10 items-center justify-center rounded-full border border-dashed border-neutral-600">
              <Feather name="user-plus" size={20} color="#00C8B3" />
            </View>
            <Text className="text-base font-semibold text-[#00C8B3]">
              Add Member
            </Text>
          </Pressable>

          <Button
            label="Save Changes"
            variant="outline"
            onPress={() => void handleSave()}
            fullWidth
            disabled={isSaving}
            className="mb-8"
          />

          <View className="mb-4 flex-row items-center gap-2">
            <Feather name="calendar" size={18} color="#A4A4A4" />
            <Text className="text-sm text-neutral-400">Events</Text>
          </View>

          <View className="mb-4 flex-row rounded-full bg-background-900 p-1">
            {(['upcoming', 'past'] as const).map((t) => {
              const count =
                t === 'upcoming' ? upcomingTabEvents.length : past.length;
              const label =
                t === 'upcoming' ? `Upcoming (${count})` : `Past (${count})`;
              const isActive = eventsTab === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setEventsTab(t)}
                  className={`flex-1 items-center rounded-full py-2.5 ${isActive ? 'bg-accent-100' : 'bg-transparent'}`}
                >
                  <Text
                    className={`text-sm font-semibold ${isActive ? '!text-black' : 'text-neutral-400'}`}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {eventsPending ? (
            <Text className="mb-8 text-sm text-neutral-500">
              Loading events…
            </Text>
          ) : (
            <View className="mb-8">
              {(eventsTab === 'upcoming' ? upcomingTabEvents : past).length ===
              0 ? (
                <Text className="text-sm text-neutral-500">
                  {eventsTab === 'upcoming'
                    ? 'No upcoming events.'
                    : 'No past events.'}
                </Text>
              ) : (
                (eventsTab === 'upcoming' ? upcomingTabEvents : past).map(
                  (ev) => {
                    const isLive =
                      eventsTab === 'upcoming' &&
                      current.some((c) => c.id === ev.id);
                    return (
                      <GroupEventCard
                        key={ev.id}
                        event={eventToCardData(ev)}
                        isLive={isLive}
                        onPress={() => router.push(`/event/${ev.id}` as const)}
                      />
                    );
                  }
                )
              )}
            </View>
          )}

          <Pressable
            onPress={() => void handleLeaveGroup()}
            disabled={isLeaving}
            className="mb-3 h-10 flex-row items-center justify-center gap-2 rounded-xl border"
            style={{ borderColor: colors.danger[500] }}
          >
            <Feather name="log-out" size={20} color={colors.danger[500]} />
            <Text
              className="text-base font-semibold"
              style={{ color: colors.danger[500] }}
            >
              Leave Group
            </Text>
          </Pressable>

          {isGroupOwner ? (
            <Pressable
              onPress={confirmDeleteGroup}
              disabled={isDeleting}
              className="h-10 flex-row items-center justify-center gap-2 rounded-xl border"
              style={{ borderColor: colors.danger[500] }}
            >
              <Feather name="trash-2" size={20} color={colors.danger[500]} />
              <Text
                className="text-base font-semibold"
                style={{ color: colors.danger[500] }}
              >
                Delete Group
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <MemberPickerModal
          visible={memberPickerOpen}
          onClose={() => setMemberPickerOpen(false)}
          candidates={addMemberCandidates}
          selectedIds={EMPTY_USER_IDS}
          onConfirm={handlePickerConfirm}
          title="Add Member"
        />
      </SafeAreaView>
    </>
  );
}
