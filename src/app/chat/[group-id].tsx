import Octicons from '@expo/vector-icons/Octicons';
import { useQueries } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { useGroup } from '@/api/groups/use-groups';
import { fetchUser } from '@/api/people/use-users';
import { ChatInput } from '@/components/chat/chat-input';
import { MessageList } from '@/components/chat/message-list';
import { SchedulerModal } from '@/components/chat/scheduler-modal';
import { colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useGroupChat } from '@/lib/hooks/use-group-chat';
import type { GroupIdT, UserIdT } from '@/types';

export default function GroupChatScreen() {
  const params = useLocalSearchParams<{ 'group-id'?: string | string[] }>();
  const groupId = Array.isArray(params['group-id'])
    ? params['group-id'][0]
    : params['group-id'];
  const userId = useAuth.use.userId() as UserIdT;
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  const { data: group } = useGroup({
    variables: groupId as GroupIdT,
    enabled: Boolean(groupId),
  });
  const memberIds: string[] = useMemo(() => group?.members ?? [], [group]);

  const {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    isSending,
    encryptionReady,
    send,
  } = useGroupChat((groupId as GroupIdT) ?? null, userId, memberIds);

  const memberQueries = useQueries({
    queries: memberIds.map((id) => ({
      queryKey: ['users', 'userId', id],
      queryFn: () => fetchUser(id as UserIdT),
    })),
  });

  const senderNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    memberQueries.forEach((q) => {
      if (q.data) map[q.data.id] = q.data.displayName || q.data.username;
    });
    return map;
  }, [memberQueries]);

  return (
    <View className="flex-1 bg-background-950">
      <Stack.Screen
        options={{
          title: group?.name ?? 'Chat',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setSchedulerOpen(true)}
              className="mr-4"
              accessibilityLabel="Open availability scheduler"
              accessibilityRole="button"
            >
              <Octicons name="calendar" size={22} color={colors.text[800]} />
            </TouchableOpacity>
          ),
        }}
      />

      <MessageList
        messages={messages}
        currentUserId={userId}
        groupId={groupId as GroupIdT}
        senderNames={senderNames}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        loadMore={loadMore}
      />

      <ChatInput
        onSend={send}
        isSending={isSending}
        disabled={!encryptionReady}
      />

      {schedulerOpen && group && (
        <SchedulerModal
          groupId={groupId as GroupIdT}
          memberIds={memberIds}
          memberNames={senderNames}
          currentUserId={userId}
          onClose={() => setSchedulerOpen(false)}
        />
      )}
    </View>
  );
}
