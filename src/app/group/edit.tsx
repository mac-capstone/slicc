// src/app/group/edit.tsx — create new group only. Existing groups: `/group/[id]/members`.
import Feather from '@expo/vector-icons/Feather';
import { useQueries } from '@tanstack/react-query';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { useCreateGroup } from '@/api/groups/use-groups';
import { fetchUser } from '@/api/people/use-users';
import { useFriendUserIds } from '@/api/social/friendships';
import { MemberPickerModal } from '@/components/member-picker-modal';
import {
  PersonAvatar,
  personAvatarColorForIndex,
} from '@/components/person-avatar';
import {
  Button,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
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

function CreateGroupScreen() {
  const currentUserId = useAuth.use.userId() as UserIdT | null;

  const [groupTitle, setGroupTitle] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<UserIdT>>(
    () => new Set()
  );
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (currentUserId) {
      setSelectedMemberIds(new Set([currentUserId]));
    }
  }, [currentUserId]);

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

  const canRemoveMember = (memberId: UserIdT): boolean =>
    !!currentUserId && memberId !== currentUserId;

  const removeMember = (uid: UserIdT): void => {
    if (!canRemoveMember(uid)) return;
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
  };

  const createGroup = useCreateGroup();
  const isSaving = createGroup.isPending;

  const handleSave = async (): Promise<void> => {
    if (!currentUserId || isSaving) return;

    const members = Array.from(selectedMemberIds);
    if (!members.includes(currentUserId)) members.unshift(currentUserId);

    try {
      const newGroupId = uuidv4() as GroupIdT;
      await createGroup.mutateAsync({
        groupId: newGroupId,
        data: {
          name: groupTitle,
          description: '',
          owner: currentUserId,
          admins: [currentUserId],
          members,
          events: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      });
      router.back();
    } catch (err) {
      console.error('Failed to save group:', err);
      Alert.alert('Error', 'Failed to create group, please try again.');
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-background-950">
        <View className="flex-row items-center px-4 pb-3">
          <Pressable onPress={() => router.back()} className="p-1">
            <Feather name="arrow-left" size={24} color="#ffffff" />
          </Pressable>
          <Text className="ml-2 text-xl font-semibold text-white">
            Create group
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
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
            className="mb-8 flex-row items-center py-3"
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

          <View className="gap-3">
            <Button
              label="Create group"
              variant="outline"
              onPress={() => void handleSave()}
              fullWidth
              disabled={isSaving}
            />
            <Pressable
              onPress={() => router.back()}
              className="h-11 items-center justify-center rounded-xl border border-red-600"
            >
              <Text className="text-base font-semibold text-red-500">
                Cancel
              </Text>
            </Pressable>
          </View>
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

export default function GroupFormScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupIdParam = params.groupId as GroupIdT | undefined;
  if (groupIdParam) {
    return <Redirect href={`/group/${groupIdParam}/members`} />;
  }
  return <CreateGroupScreen />;
}
