import { useQueries } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { useGroup, useLeaveGroup } from '@/api/groups/use-groups';
import { fetchUser } from '@/api/people/use-users';
import { AddButton } from '@/components/add-button';
import { colors, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { GroupIdT, UserIdT } from '@/types';

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

  const leaveGroup = useLeaveGroup();

  const userQueries = useQueries({
    queries: (group?.members ?? []).map((userId) => ({
      queryKey: ['users', 'userId', userId] as const,
      queryFn: () => fetchUser(userId as UserIdT),
    })),
  });

  const memberDetails = useMemo(() => {
    if (!group) return [];
    return group.members.map((userId, index) => {
      const user = userQueries[index]?.data;
      const isAdmin = group.owner === userId || group.admins.includes(userId);
      return {
        id: userId,
        name: user?.displayName ?? 'Unknown',
        username: user?.username ?? '',
        isAdmin,
      };
    });
  }, [group, userQueries]);

  const handleEditGroup = () => {
    router.push(`/group/edit?groupId=${groupId}`);
  };

  const handleLeaveGroup = (): void => {
    if (!currentUserId) return;

    leaveGroup.mutate(
      { groupId, userId: currentUserId },
      {
        onSuccess: () => router.replace('/social'),
        onError: (err) => {
          console.error('Failed to leave group:', err);
          Alert.alert('Error', 'Failed to leave group, please try again.');
        },
      }
    );
  };

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">Loading...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">Failed to load group</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">Group not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: group.name }} />
      <View className="flex-1 bg-background-950">
        <ScrollView className="flex-1 p-4">
          <Text className="mb-3 text-base text-neutral-300">
            {memberDetails.length} Members
          </Text>

          <View className="rounded-xl bg-neutral-900 px-4 py-2">
            {memberDetails.map((member, index) => (
              <View key={member.id}>
                <View className="flex-row items-center py-3">
                  <View className="mr-3 size-9 items-center justify-center rounded-full bg-red-500">
                    <Text className="text-lg text-white">
                      {member.name.charAt(0)}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <Text className="text-base text-white">{member.name}</Text>
                    {member.username ? (
                      <Text className="text-xs text-gray-400">
                        @{member.username}
                      </Text>
                    ) : null}
                  </View>

                  {member.isAdmin ? (
                    <Text className="text-xs font-semibold text-neutral-300">
                      Admin
                    </Text>
                  ) : null}
                </View>

                {index < memberDetails.length - 1 && (
                  <View className="h-px bg-neutral-800" />
                )}
              </View>
            ))}
          </View>
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
