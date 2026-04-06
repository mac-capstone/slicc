import { useQueries } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEventsByGroupId } from '@/api/events/use-events';
import { useGroup } from '@/api/groups/use-groups';
import { fetchUser } from '@/api/people/use-users';
import { ChatEventsCollapsible } from '@/components/chat/chat-events-collapsible';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatScreenHeader } from '@/components/chat/chat-screen-header';
import { MessageList } from '@/components/chat/message-list';
import { useAuth } from '@/lib/auth';
import { useGroupChat } from '@/lib/hooks/use-group-chat';
import type { GroupIdT, UserIdT } from '@/types';

/** Keyboard offset below custom header + status (header handles safe top). */
const HEADER_BODY = 52;

export default function GroupChatScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 'group-id'?: string | string[] }>();
  const groupId = (
    Array.isArray(params['group-id'])
      ? params['group-id'][0]
      : params['group-id']
  ) as GroupIdT | undefined;
  const userId = useAuth.use.userId() as UserIdT;

  const {
    data: group,
    isPending: groupPending,
    isError: groupError,
  } = useGroup({
    variables: groupId as GroupIdT,
    enabled: Boolean(groupId),
  });
  const memberIds: string[] = useMemo(() => group?.members ?? [], [group]);

  const { data: events = [], isPending: eventsPending } = useEventsByGroupId({
    variables: groupId as GroupIdT,
    enabled: Boolean(groupId),
  });

  const {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    isSending,
    encryptionReady,
    groupKey,
    send,
    sendImage,
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

  if (!groupId) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950" />
    );
  }

  if (groupPending || groupError || !group) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950" />
    );
  }

  return (
    <View className="flex-1 bg-charcoal-950">
      <ChatScreenHeader
        groupId={groupId}
        groupName={group.name}
        memberCount={memberIds.length}
      />

      <ChatEventsCollapsible events={events} isPending={eventsPending} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? insets.top + HEADER_BODY : 0
        }
      >
        <MessageList
          messages={messages}
          currentUserId={userId}
          groupId={groupId}
          senderNames={senderNames}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          loadMore={loadMore}
          groupKey={groupKey}
        />

        <ChatInput
          onSend={send}
          onSendImage={sendImage}
          isSending={isSending}
          disabled={!encryptionReady}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
