// src/app/group/edit.tsx
import Feather from '@expo/vector-icons/Feather';
import Octicons from '@expo/vector-icons/Octicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { mockData } from '@/lib/mock-data';
import type { GroupIdT, UserIdT } from '@/types';

// ---------------------------------------------------------------------------
// Inline helper — renders a user avatar from mockData color without needing
// an event/expense context (PersonAvatar requires one of those).
// ---------------------------------------------------------------------------
function UserAvatar({ userId, size = 36 }: { userId: UserIdT; size?: number }) {
  const user = mockData.users.find((u) => u.id === userId);
  const bgColor =
    colors.avatar[(user?.doc.color ?? 'white') as keyof typeof colors.avatar] ??
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
// Main screen
// ---------------------------------------------------------------------------
export default function GroupFormScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = params.groupId as GroupIdT | undefined;
  const currentUserId = useAuth.use.userId();

  const group = useMemo(
    () => (groupId ? mockData.groups.find((g) => g.id === groupId) : undefined),
    [groupId]
  );
  const isEditing = !!group;
  // ---- local state --------------------------------------------------------
  const [groupTitle, setGroupTitle] = useState(group?.doc.title ?? '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<UserIdT>>(
    () => new Set((group?.doc.memberIds ?? []) as UserIdT[])
  );
  const [tab, setTab] = useState<'selected' | 'allFriends'>('selected');
  const [searchQuery, setSearchQuery] = useState('');
  const nameInputRef = useRef<TextInput>(null);

  // ---- derived list -------------------------------------------------------
  const displayedUsers = useMemo(() => {
    const base =
      tab === 'selected'
        ? mockData.users.filter((u) => selectedMemberIds.has(u.id as UserIdT))
        : mockData.users;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.trim().toLowerCase();
    return base.filter((u) => u.doc.displayName.toLowerCase().includes(q));
  }, [tab, selectedMemberIds, searchQuery]);

  // ---- actions ------------------------------------------------------------
  const toggleMember = (uid: UserIdT) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSave = () => {
    // TODO: replace with Firebase mutation when backend is wired up
    if (group) {
      // group.doc.title = groupTitle;
      // group.doc.memberIds = Array.from(selectedMemberIds);
    }
    router.back();
  };

  // ---- render -------------------------------------------------------------
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
          {/* ── Group header row ── */}
          <View className="mb-6 flex-row items-center">
            {/* Photo placeholder */}
            <Pressable
              className="mr-4 size-14 items-center justify-center
  rounded-full bg-neutral-700"
            >
              <Octicons name="person" size={26} color="#A4A4A4" />
            </Pressable>

            {/* Editable group name */}
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

            {/* Current-user avatar badge */}
            {currentUserId && (
              <View className="ml-3">
                <UserAvatar userId={currentUserId} size={36} />
              </View>
            )}
          </View>

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
                const user = mockData.users.find((u) => u.id === uid);
                return (
                  <View
                    key={uid}
                    className="mr-2 flex-row items-center rounded-full
  bg-neutral-800 px-2 py-1"
                  >
                    <UserAvatar userId={uid} size={20} />
                    <Text className="ml-1 text-sm text-white">
                      {user?.doc.displayName.split(' ')[0]}
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
            {displayedUsers.map((user) => {
              const uid = user.id as UserIdT;
              const isMember = selectedMemberIds.has(uid);
              return (
                <View
                  key={uid}
                  className="flex-row items-center border-b border-neutral-800
   py-3"
                >
                  <UserAvatar userId={uid} size={36} />
                  <Text className="ml-3 flex-1 text-base text-white">
                    {user.doc.displayName}
                  </Text>
                  {isMember ? (
                    <Pressable onPress={() => toggleMember(uid)}>
                      <Text className="text-sm font-semibold text-red-500">
                        Remove
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => toggleMember(uid)}
                      className="flex-row items-center gap-1"
                    >
                      <Octicons name="person-add" size={14} color="#D4D4D4" />
                      <Text className="ml-1 text-sm font-semibold text-white">
                        Add
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          {/* ── Bottom buttons ── */}
          <View className="mt-8 gap-3">
            <Button
              label={isEditing ? 'Save Changes' : 'Create group'}
              variant="outline"
              onPress={handleSave}
              fullWidth
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
