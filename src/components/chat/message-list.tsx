import * as React from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { colors, Text } from '@/components/ui';
import type { ChatMessageWithId, UserIdT } from '@/types';

import { MessageBubble } from './message-bubble';

type Props = {
  messages: ChatMessageWithId[];
  currentUserId: UserIdT | null;
  senderNames: Record<string, string>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
};

function EmptyChat() {
  return (
    <View className="flex-1 items-center justify-center pb-16">
      <Text className="text-center text-sm text-text-800">
        No messages yet. Say hello!
      </Text>
    </View>
  );
}

function LoadingMoreSpinner() {
  return (
    <View className="items-center py-3">
      <ActivityIndicator size="small" color={colors.primary[500]} />
    </View>
  );
}

export function MessageList({
  messages,
  currentUserId,
  senderNames,
  isLoading,
  isLoadingMore,
  hasMore,
  loadMore,
}: Props) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MessageBubble
          message={item}
          isMine={item.senderId === currentUserId}
          senderName={senderNames[item.senderId] ?? 'Member'}
        />
      )}
      // Inverted renders data[0] (newest) at the visual bottom.
      // The user always opens the chat at the latest message with zero scroll logic.
      // Scrolling UP toward older messages naturally triggers onEndReached.
      inverted
      // Fire loadMore when the user is 30% away from the top (visual top = oldest end)
      onEndReached={hasMore && !isLoadingMore ? loadMore : undefined}
      onEndReachedThreshold={0.3}
      // Spinner shown at the visual top while older messages are being fetched
      ListFooterComponent={isLoadingMore ? <LoadingMoreSpinner /> : null}
      ListEmptyComponent={<EmptyChat />}
      contentContainerStyle={{
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 12,
      }}
    />
  );
}
