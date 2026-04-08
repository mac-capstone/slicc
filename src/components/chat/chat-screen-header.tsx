import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Octicons from '@expo/vector-icons/Octicons';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, Text } from '@/components/ui';
import { router } from '@/lib/guarded-router';
import type { GroupIdT } from '@/types';

type Props = {
  groupId: GroupIdT;
  groupName: string;
  memberCount: number;
};

export function ChatScreenHeader({ groupId, groupName, memberCount }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.charcoal[950],
        borderBottomWidth: 1,
        borderBottomColor: colors.charcoal[800],
      }}
    >
      <View className="flex-row items-center px-2 pb-2 pt-1">
        <Pressable
          onPress={() => router.back()}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={22} color={colors.white} />
        </Pressable>

        <Pressable
          onPress={() => router.push(`/group/${groupId}/members` as const)}
          className="min-w-0 flex-1 px-1"
          accessibilityRole="button"
          accessibilityLabel={`${groupName}, open group`}
        >
          <Text className="text-lg font-bold text-white" numberOfLines={1}>
            {groupName}
          </Text>
          <Text className="text-xs" style={{ color: colors.charcoal[400] }}>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push(`/chat/${groupId}/availability` as const)}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="Availability"
        >
          <Octicons name="clock" size={22} color={colors.accent[100]} />
        </Pressable>

        <Pressable
          onPress={() =>
            router.push(`/event/edit-event?groupId=${groupId}` as const)
          }
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="Create new event"
        >
          <MaterialCommunityIcons
            name="calendar-plus"
            size={26}
            color={colors.accent[100]}
          />
        </Pressable>
      </View>
    </View>
  );
}
