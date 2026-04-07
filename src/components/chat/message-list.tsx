import * as React from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { MessageBubble } from '@/components/chat/message-bubble';
import { PersonAvatar } from '@/components/person-avatar';
import { colors, Text } from '@/components/ui';
import type { ChatMessageWithId, UserIdT } from '@/types';

type Props = {
  messages: ChatMessageWithId[];
  currentUserId: UserIdT | null;
  groupId: string;
  groupKey: string | null;
  senderNames: Record<string, string>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
};

/** Rendered outside inverted FlatList so the copy is never flipped by `inverted`. */
function EmptyChat() {
  return (
    <View className="flex-1 items-center justify-center px-4 pb-16">
      <Text className="text-center text-sm text-charcoal-300">
        No messages yet. Say hello!
      </Text>
    </View>
  );
}

function LoadingMoreSpinner() {
  return (
    <View className="items-center py-3" style={{ transform: [{ scaleY: -1 }] }}>
      <ActivityIndicator size="small" color={colors.accent[100]} />
    </View>
  );
}

export function MessageList({
  messages,
  currentUserId,
  groupId,
  groupKey,
  senderNames,
  isLoading,
  isLoadingMore,
  hasMore,
  loadMore,
}: Props) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <ActivityIndicator color={colors.accent[100]} />
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View className="flex-1 bg-charcoal-950">
        <EmptyChat />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1 }}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const isMine = item.senderId === currentUserId;
        const showPeerAvatar = !isMine && item.type !== 'system';

        return (
          <View
            style={{
              flexDirection: 'row',
              justifyContent:
                item.type === 'system'
                  ? 'center'
                  : isMine
                    ? 'flex-end'
                    : 'flex-start',
              marginBottom: 4,
            }}
          >
            {showPeerAvatar ? (
              <View className="mr-1.5 self-end pb-6">
                <PersonAvatar userId={item.senderId as UserIdT} size={28} />
              </View>
            ) : null}
            <MessageBubble
              message={item}
              isMine={isMine}
              senderName={senderNames[item.senderId] ?? 'Member'}
              currentUserId={currentUserId ?? ''}
              groupId={groupId}
              groupKey={groupKey}
            />
          </View>
        );
      }}
      // Inverted renders data[0] (newest) at the visual bottom.
      // The user always opens the chat at the latest message with zero scroll logic.
      // Scrolling UP toward older messages naturally triggers onEndReached.
      inverted
      // Fire loadMore when the user is 30% away from the top (visual top = oldest end)
      onEndReached={hasMore && !isLoadingMore ? loadMore : undefined}
      onEndReachedThreshold={0.3}
      // Spinner shown at the visual top while older messages are being fetched
      ListFooterComponent={isLoadingMore ? <LoadingMoreSpinner /> : null}
      contentContainerStyle={{
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 12,
        flexGrow: 1,
      }}
    />
  );
}
