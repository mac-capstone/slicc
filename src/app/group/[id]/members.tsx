import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { AddButton } from '@/components/add-button';
import { colors, Text } from '@/components/ui';
import { mockData } from '@/lib/mock-data';
import type { GroupIdT, UserIdT } from '@/types';

export default function GroupMembersScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id as GroupIdT;

  // TODO: replace with real auth when ready
  const currentUserId = 'user_ankush' as UserIdT;
  // const [refreshKey, setRefreshKey] = useState(0);

  const group = useMemo(() => {
    const gr = mockData.groups.find((g) => g.id === groupId);
    if (!gr) {
      throw new Error('group not found');
    }
    return gr;
  }, [groupId]);

  const members = group.doc.memberIds as UserIdT[];
  const handleEditGroup = () => {
    router.push(`/group/edit?groupId=${groupId}`);
  };
  const handleLeaveGroup = () => {
    // Remove current user from this group's memberIds
    // below code not removing data from "mock-data.ts" file
    const oldMemberIds = group.doc.memberIds;
    const newMemberIds = oldMemberIds.filter((id) => id !== currentUserId);

    console.log('before:', oldMemberIds);
    console.log('after:', newMemberIds);

    if (newMemberIds.length === oldMemberIds.length) {
      // current user was not in the group; nothing to do
      return;
    }

    group.doc.memberIds = newMemberIds;

    // // remove current user from group
    // const idx = group.doc.memberIds.indexOf(currentUserId);
    // console.log(idx);
    // if (idx !== -1) {
    //   group.doc.memberIds.splice(idx, 1);
    // }

    // if they were admin, reassign or clear
    if (group.doc.adminId === currentUserId) {
      const newAdminId = newMemberIds[0] ?? null;
      console.log('new admin:', newAdminId);
      group.doc.adminId = newAdminId;
    }

    // go back to Groups list
    router.replace('/groups');
  };
  console.log(members);

  // Build rich member objects: name + isAdmin flag
  const memberDetails = useMemo(
    () =>
      members.map((userId) => {
        const user = mockData.users.find((u) => u.id === userId);
        return {
          id: userId,
          name: user?.doc.displayName ?? 'Unknown',
          colorKey: user?.doc.color ?? 'white',
          isAdmin: group.doc.adminId === userId,
        };
      }),
    [members, group.doc.adminId]
  );

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">Group not found</Text>
      </View>
    );
  }
  // router.push(`/event/edit-event?groupId=${groupId}` as const);

  return (
    <>
      <Stack.Screen
        options={{
          title: group.doc.title,
          headerShown: true,
          headerTitleStyle: { fontSize: 28, fontWeight: 'bold' },
          headerShadowVisible: false,
        }}
      />
      <View className="flex-1 bg-background-950">
        <ScrollView className="flex-1 p-4">
          <Text className="mb-3 text-base text-neutral-300">
            {memberDetails.length} Members
          </Text>

          {/* Card-style container like your mock */}
          <View className="rounded-xl bg-neutral-900 px-4 py-2">
            {memberDetails.map((member, index) => (
              <View key={member.id}>
                <View className="flex-row items-center py-3">
                  {/* Colored circle + icon placeholder */}
                  <View className="mr-3 size-9 items-center justify-center rounded-full bg-red-500">
                    <Text className="text-lg text-white">
                      {member.name.charAt(0)}
                    </Text>
                  </View>
                  {/* <PersonAvatar
                    size="lg"
                    userId={member.id}
                    eventId={group.doc.eventIds[0]}
                  /> */}

                  {/* Name */}
                  <View className="flex-1">
                    <Text className="text-base text-white">{member.name}</Text>
                  </View>

                  {/* Right-side label: Admin (for now, no Remove button) */}
                  {member.isAdmin ? (
                    <Text className="text-xs font-semibold text-neutral-300">
                      Admin
                    </Text>
                  ) : null}
                </View>

                {/* Divider between rows */}
                {index < memberDetails.length - 1 && (
                  <View className="h-px bg-neutral-800" />
                )}
              </View>
            ))}
          </View>

          {/* Later you can add Add Members / Leave Group buttons here */}
        </ScrollView>
        <View className="px-4 pb-10 pt-2">
          <AddButton
            label="Edit Group"
            onPress={handleEditGroup}
            className="mt-2"
            borderColor={colors.white}
            borderWidth={1.2}
            heightClassName="h-14"
          />
          <AddButton
            label="Leave Group"
            onPress={handleLeaveGroup}
            className="mt-2"
            borderColor={colors.danger[500]}
            borderWidth={1.2}
            heightClassName="h-14"
          />
        </View>
      </View>
    </>
  );
}
