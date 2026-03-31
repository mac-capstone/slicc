import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { fetchEncryptedImageBytes, toggleReaction } from '@/api/chat/messages';
import { colors, Image, Text } from '@/components/ui';
import { bytesToB64, decryptBytes } from '@/lib/crypto/e2e-crypto';
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
  groupKey: string | null;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SystemMessage({ text }: { text: string }) {
  return (
    <View className="my-1 items-center">
      <Text className="rounded-full bg-charcoal-850 px-3 py-1 text-[11px] text-charcoal-300">
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
  groupKey,
}: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const isSystem = message.type === 'system';

  const isLockedText =
    message.type === 'text' &&
    (message.decryptedContent == null || message.decryptedContent === '');

  useEffect(() => {
    let cancelled = false;
    if (message.type !== 'image') return () => {};
    if (!groupKey || !message.imagePath || !message.nonce) return () => {};
    if (imageUri || imageLoadFailed) return () => {};

    async function run() {
      try {
        const cipherBytes = await fetchEncryptedImageBytes(message.imagePath!);
        const cipherB64 = bytesToB64(cipherBytes);
        const plainBytes = decryptBytes(cipherB64, message.nonce!, groupKey!);
        const mime = message.mimeType ?? 'image/jpeg';
        const uri = `data:${mime};base64,${bytesToB64(plainBytes)}`;
        if (!cancelled) setImageUri(uri);
      } catch {
        if (!cancelled) setImageLoadFailed(true);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [message, groupKey, imageUri, imageLoadFailed]);

  function handleReactionToggle(emoji: string) {
    toggleReaction({
      groupId,
      messageId: message.id,
      emoji,
      userId: currentUserId,
      currentReactions: message.reactions,
    }).catch(console.error);
  }

  const bubbleBg = isMine ? colors.accent[100] : colors.charcoal[850];
  const bubbleTextColor = isMine ? colors.charcoal[950] : colors.white;
  const bubbleInner = useMemo(() => {
    if (isSystem) return null;
    if (message.type === 'location' && message.locationPayload) {
      return <LocationCard location={message.locationPayload} />;
    }
    if (message.type === 'image') {
      if (imageUri) {
        return (
          <Image
            source={{ uri: imageUri }}
            style={{ width: 220, height: 220, borderRadius: 14 }}
            contentFit="cover"
          />
        );
      }
      if (imageLoadFailed) {
        return (
          <Text
            className="text-sm leading-5"
            style={{ color: bubbleTextColor }}
          >
            Image unavailable
          </Text>
        );
      }
      return (
        <View
          style={{
            width: 220,
            height: 220,
            borderRadius: 14,
            backgroundColor: isMine ? colors.accent[200] : colors.charcoal[800],
          }}
        />
      );
    }
    if (isLockedText) return null; // locked messages should never show
    return (
      <Text className="text-sm leading-5" style={{ color: bubbleTextColor }}>
        {message.decryptedContent}
      </Text>
    );
  }, [
    isSystem,
    message,
    imageUri,
    imageLoadFailed,
    bubbleTextColor,
    isMine,
    isLockedText,
  ]);

  // If it's a locked text message, render nothing.
  if (message.type === 'text' && isLockedText) return null;
  if (isSystem) return <SystemMessage text={message.systemText ?? ''} />;

  return (
    // maxWidth caps the bubble at 80 % of screen width so long messages wrap.
    // Left/right positioning is handled by the row container in MessageList.
    <View style={{ maxWidth: '80%', marginBottom: 8 }}>
      {!isMine && (
        <Text
          className="mb-0.5 ml-1 text-xs font-semibold"
          style={{ color: colors.charcoal[300] }}
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
          {bubbleInner}
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
          color: colors.charcoal[400],
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
