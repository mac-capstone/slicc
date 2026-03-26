import * as React from 'react';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { toggleReaction } from '@/api/chat/messages';
import { colors, Text } from '@/components/ui';
import type { ChatMessageWithId } from '@/types';

import { LocationCard } from './location-card';
import { ReactionPicker } from './reaction-picker';
import { ReactionPills } from './reaction-pills';

type Props = {
  message: ChatMessageWithId;
  isMine: boolean;
  senderName: string;
  currentUserId: string;
  groupId: string;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SystemMessage({ text }: { text: string }) {
  return (
    <View className="my-1 items-center">
      <Text className="rounded-full bg-background-900 px-3 py-1 text-[11px] text-text-800">
        {text}
      </Text>
    </View>
  );
}

export function MessageBubble({
  message,
  isMine,
  senderName,
  currentUserId,
  groupId,
}: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);

  if (message.type === 'system') {
    return <SystemMessage text={message.systemText ?? ''} />;
  }

  function handleReactionToggle(emoji: string) {
    toggleReaction({
      groupId,
      messageId: message.id,
      emoji,
      userId: currentUserId,
      currentReactions: message.reactions,
    }).catch(console.error);
  }

  const bubbleBg = isMine ? colors.accent[800] : colors.accent[900];

  return (
    // maxWidth caps the bubble at 80 % of screen width so long messages wrap.
    // Left/right positioning is handled by the row container in MessageList.
    <View style={{ maxWidth: '80%', marginBottom: 8 }}>
      {!isMine && (
        <Text
          className="mb-0.5 ml-1 text-xs font-semibold"
          style={{ color: colors.accent[100] }}
        >
          {senderName}
        </Text>
      )}

      <TouchableOpacity
        onLongPress={() => setPickerVisible(true)}
        delayLongPress={300}
        activeOpacity={0.85}
        accessibilityHint="Long press to react"
      >
        <View
          style={{
            backgroundColor: bubbleBg,
            borderRadius: 20,
            borderTopRightRadius: isMine ? 4 : 20,
            borderTopLeftRadius: isMine ? 20 : 4,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          {message.type === 'location' && message.locationPayload ? (
            <LocationCard location={message.locationPayload} />
          ) : (
            <Text
              className="text-sm leading-5"
              style={{ color: colors.text[50] }}
            >
              {message.decryptedContent ?? '🔒'}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      <ReactionPills
        reactions={message.reactions}
        currentUserId={currentUserId}
        onToggle={handleReactionToggle}
      />

      <Text
        style={{
          fontSize: 10,
          marginTop: 2,
          color: colors.text[800],
          marginLeft: isMine ? 0 : 4,
          marginRight: isMine ? 4 : 0,
        }}
      >
        {formatTime(message.sentAt)}
      </Text>

      {pickerVisible && (
        <ReactionPicker
          onSelect={handleReactionToggle}
          onDismiss={() => setPickerVisible(false)}
        />
      )}
    </View>
  );
}
