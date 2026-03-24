import Octicons from '@expo/vector-icons/Octicons';
import { router } from 'expo-router';
import * as React from 'react';
import { useState } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';

import { fetchGroup, useGroupIds } from '@/api/groups/use-groups';
import { colors, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { GroupIdT, UserIdT } from '@/types';

type GroupChatRowProps = { groupId: GroupIdT; onClose: () => void };

function GroupChatRow({ groupId, onClose }: GroupChatRowProps) {
  const [name, setName] = React.useState('...');

  React.useEffect(() => {
    fetchGroup(groupId).then((g) => setName(g.name));
  }, [groupId]);

  return (
    <TouchableOpacity
      onPress={() => {
        onClose();
        router.push(`/chat/${groupId}`);
      }}
      className="mb-2 flex-row items-center gap-3 rounded-xl bg-background-900 px-4 py-3"
    >
      <View className="size-8 items-center justify-center rounded-full bg-primary-600/20">
        <Octicons
          name="comment-discussion"
          size={16}
          color={colors.primary[500]}
        />
      </View>
      <Text
        className="flex-1 text-sm font-medium text-text-50"
        numberOfLines={1}
      >
        {name}
      </Text>
      <Octicons name="chevron-right" size={14} color={colors.text[800]} />
    </TouchableOpacity>
  );
}

/** Floating action button that opens a quick-access group chat picker. */
export function ChatFab() {
  const [open, setOpen] = useState(false);
  const userId = useAuth.use.userId() as UserIdT;
  const { data: groupIds = [] } = useGroupIds({ variables: userId });

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="absolute bottom-6 right-5 size-14 items-center justify-center rounded-full bg-primary-600 shadow-lg"
        style={{ elevation: 6 }}
        accessibilityLabel="Open group chats"
        accessibilityRole="button"
      >
        <Octicons name="comment-discussion" size={24} color="#ffffff" />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl bg-background-925 px-4 pb-10 pt-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-text-50">
                Group Chats
              </Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                accessibilityRole="button"
              >
                <Octicons name="x" size={20} color={colors.text[800]} />
              </TouchableOpacity>
            </View>

            {groupIds.length === 0 ? (
              <Text className="py-4 text-center text-sm text-text-800">
                No groups yet. Create one from the Groups tab.
              </Text>
            ) : (
              groupIds.map((id) => (
                <GroupChatRow
                  key={id}
                  groupId={id as GroupIdT}
                  onClose={() => setOpen(false)}
                />
              ))
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
