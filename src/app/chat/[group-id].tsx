import Octicons from '@expo/vector-icons/Octicons';
import { useQueries } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGroup } from '@/api/groups/use-groups';
import { fetchUser } from '@/api/people/use-users';
import { ChatInput } from '@/components/chat/chat-input';
import { MessageList } from '@/components/chat/message-list';
import { SchedulerModal } from '@/components/chat/scheduler-modal';
import { colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useGroupChat } from '@/lib/hooks/use-group-chat';
import { getPerfLogFileUri, perfLog } from '@/lib/perf-log';
import type { GroupIdT, UserIdT } from '@/types';

/** Approximate stack header bar height below the status bar (Material ≈ 56). */
const HEADER_BAR = 56;

export default function GroupChatScreen() {
  const insets = useSafeAreaInsets();
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

  useEffect(() => {
    if (!groupId) return;
    perfLog('chat_mount', { groupId });
    perfLog('chat_perf_log_path', { uri: getPerfLogFileUri() });
  }, [groupId]);

  return (
    <View className="flex-1 bg-charcoal-950">
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
              <Octicons name="calendar" size={22} color={colors.accent[100]} />
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={insets.top + HEADER_BAR}
      >
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
      </KeyboardAvoidingView>

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
