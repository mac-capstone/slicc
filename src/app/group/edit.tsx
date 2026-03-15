// src/app/group/edit.tsx
import Feather from '@expo/vector-icons/Feather';
import Octicons from '@expo/vector-icons/Octicons';
import { useQueries } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';

import {
  useCreateGroup,
  useGroup,
  useUpdateGroup,
} from '@/api/groups/use-groups';
import { fetchUser, useUser, useUserIds } from '@/api/people/use-users';
import {
  Button,
  colors,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { GroupIdT, UserIdT } from '@/types';

// ---------------------------------------------------------------------------
// Inline helper — renders a user avatar using useUser for displayName/color
// ---------------------------------------------------------------------------
function UserAvatar({ userId, size = 36 }: { userId: UserIdT; size?: number }) {
  const { data: user } = useUser({ variables: userId });
  const colorKey = (user as { color?: string } | undefined)?.color ?? 'white';
  const bgColor =
    colors.avatar[colorKey as keyof typeof colors.avatar] ??
    colors.avatar.white;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
      }}
      className="items-center justify-center"
    >
      <Octicons name="person" size={Math.round(size * 0.55)} color="#D4D4D4" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Group header with editable name
// ---------------------------------------------------------------------------
function GroupHeaderRow({
  groupTitle,
  setGroupTitle,
  isEditingName,
  setIsEditingName,
  nameInputRef,
  currentUserId,
}: {
  groupTitle: string;
  setGroupTitle: (v: string) => void;
  isEditingName: boolean;
  setIsEditingName: (v: boolean) => void;
  nameInputRef: React.RefObject<TextInput | null>;
  currentUserId: UserIdT | null;
}) {
  return (
    <View className="mb-6 flex-row items-center">
      <Pressable className="mr-4 size-14 items-center justify-center rounded-full bg-neutral-700">
        <Octicons name="person" size={26} color="#A4A4A4" />
      </Pressable>
      <View className="flex-1">
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
            }}
          />
        ) : (
          <Pressable
            onPress={() => {
              setIsEditingName(true);
              setTimeout(() => nameInputRef.current?.focus(), 50);
            }}
            className="flex-row items-center gap-2"
          >
            <Text className="text-2xl font-bold text-white">
              {groupTitle || 'Group name'}
            </Text>
            <Feather name="edit-2" size={16} color="#A4A4A4" />
          </Pressable>
        )}
      </View>
      {currentUserId && (
        <View className="ml-3">
          <UserAvatar userId={currentUserId} size={36} />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Member list item
// ---------------------------------------------------------------------------
function MemberRow({
  user,
  isMember,
  onToggle,
}: {
  user: { id: string; displayName: string };
  isMember: boolean;
  onToggle: () => void;
}) {
  const uid = user.id as UserIdT;
  return (
    <View className="flex-row items-center border-b border-neutral-800 py-3">
      <UserAvatar userId={uid} size={36} />
      <Text className="ml-3 flex-1 text-base text-white">
        {user.displayName}
      </Text>
      {isMember ? (
        <Pressable onPress={onToggle}>
          <Text className="text-sm font-semibold text-red-500">Remove</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onToggle} className="flex-row items-center gap-1">
          <Octicons name="person-add" size={14} color="#D4D4D4" />
          <Text className="ml-1 text-sm font-semibold text-white">Add</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function GroupFormScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = params.groupId as GroupIdT | undefined;
  const currentUserId = useAuth.use.userId();

  const { data: group } = useGroup({
    variables: groupId!,
    enabled: !!groupId,
  });

  const hasGroupId = Boolean(groupId);
  const groupLoaded = !hasGroupId || !!group;

  const [groupTitle, setGroupTitle] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<UserIdT>>(
    () => new Set()
  );
  const [tab, setTab] = useState<'selected' | 'allFriends'>('selected');
  const [searchQuery, setSearchQuery] = useState('');
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (group) {
      setGroupTitle(group.name);
      setSelectedMemberIds(new Set(group.members as UserIdT[]));
    }
  }, [group]);

  const { data: userIds = [] } = useUserIds();

  const userQueries = useQueries({
    queries: userIds.map((id) => ({
      queryKey: ['users', 'userId', id] as const,
      queryFn: () => fetchUser(id),
    })),
  });

  const users = useMemo(
    () =>
      userQueries
        .map((q) => q.data)
        .filter((u): u is NonNullable<typeof u> => u != null),
    [userQueries]
  );

  const displayedUsers = useMemo(() => {
    const base =
      tab === 'selected'
        ? users.filter((u) => selectedMemberIds.has(u.id as UserIdT))
        : users;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.trim().toLowerCase();
    return base.filter((u) => u.displayName.toLowerCase().includes(q));
  }, [tab, selectedMemberIds, searchQuery, users]);

  const toggleMember = (uid: UserIdT) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();

  const handleSave = async () => {
    if (!currentUserId) return;
    if (!groupLoaded) return;

    const members = Array.from(selectedMemberIds);
    if (!members.includes(currentUserId)) {
      members.unshift(currentUserId);
    }

    try {
      if (hasGroupId && groupId) {
        await updateGroup.mutateAsync({
          groupId,
          data: {
            name: groupTitle,
            members,
          },
        });
      } else {
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
      }
      router.back();
    } catch (err) {
      console.error('Failed to save group:', err);
      Alert.alert(
        'Error',
        hasGroupId
          ? 'Failed to save changes, please try again.'
          : 'Failed to create group, please try again.'
      );
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView className="flex-1 bg-background-950">
        {/* ── Custom back button ── */}
        <View
          className="px-4 pb-2"
          style={{ paddingTop: Math.max(insets.top, 8) }}
        >
          <Pressable onPress={() => router.back()} className="self-start p-1">
            <Feather name="arrow-left" size={24} color="#ffffff" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <GroupHeaderRow
            groupTitle={groupTitle}
            setGroupTitle={setGroupTitle}
            isEditingName={isEditingName}
            setIsEditingName={setIsEditingName}
            nameInputRef={nameInputRef}
            currentUserId={currentUserId}
          />

          {/* ── Members label ── */}
          <Text className="mb-3 text-base text-neutral-400">Members</Text>

          {/* ── Segment toggle: Selected | All Friends ── */}
          <View className="mb-4 flex-row rounded-full bg-background-900 p-1">
            {(['selected', 'allFriends'] as const).map((t) => {
              const label = t === 'selected' ? 'Selected' : 'All Friends';
              const isActive = tab === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  className={`flex-1 items-center rounded-full py-2 ${
                    isActive ? 'bg-accent-100' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      isActive ? 'text-black' : 'text-neutral-400'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Selected-member chips ── */}
          {selectedMemberIds.size > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {Array.from(selectedMemberIds).map((uid) => {
                const user = users.find((u) => u.id === uid);
                return (
                  <View
                    key={uid}
                    className="mr-2 flex-row items-center rounded-full
  bg-neutral-800 px-2 py-1"
                  >
                    <UserAvatar userId={uid} size={20} />
                    <Text className="ml-1 text-sm text-white">
                      {user?.displayName?.split(' ')[0] ?? uid}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* ── Search bar ── */}
          <View
            className="mb-4 flex-row items-center rounded-full
  bg-neutral-900 px-4 py-2"
          >
            <Feather name="search" size={16} color="#A4A4A4" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for friends"
              placeholderTextColor="#A4A4A4"
              style={{ flex: 1, marginLeft: 8, color: '#ffffff', fontSize: 14 }}
            />
          </View>

          {/* ── Member list ── */}
          <View>
            {displayedUsers.map((user) => (
              <MemberRow
                key={user.id}
                user={user}
                isMember={selectedMemberIds.has(user.id as UserIdT)}
                onToggle={() => toggleMember(user.id as UserIdT)}
              />
            ))}
          </View>

          {/* ── Bottom buttons ── */}
          <View className="mt-8 gap-3">
            <Button
              label={hasGroupId ? 'Save Changes' : 'Create group'}
              variant="outline"
              onPress={handleSave}
              fullWidth
              disabled={!groupLoaded}
            />
            <Pressable
              onPress={() => router.back()}
              className="h-11 items-center justify-center rounded-xl border
  border-red-600"
            >
              <Text className="text-base font-semibold text-red-500">
                Cancel
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
