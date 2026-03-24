import * as React from 'react';
import { View } from 'react-native';

import { colors, Text } from '@/components/ui';
import type { ChatMessageWithId } from '@/types';

import { LocationCard } from './location-card';

type Props = {
  message: ChatMessageWithId;
  isMine: boolean;
  senderName: string;
};

/** Stable colour from a small palette, derived from the sender's name. */
const SENDER_COLOURS = [
  colors.primary[400],
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#38bdf8', // sky-400
];

function senderColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SENDER_COLOURS[hash % SENDER_COLOURS.length];
}

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

export function MessageBubble({ message, isMine, senderName }: Props) {
  if (message.type === 'system') {
    return <SystemMessage text={message.systemText ?? ''} />;
  }

  const bubbleStyle = isMine
    ? 'rounded-tr-sm bg-primary-600'
    : 'rounded-tl-sm bg-background-900';

  const timeStyle = isMine ? 'self-end mr-1' : 'ml-1';

  return (
    <View className={`mb-2 max-w-[80%] ${isMine ? 'self-end' : 'self-start'}`}>
      {/* Sender name — shown for every other participant in the group */}
      {!isMine && (
        <Text
          className="mb-0.5 ml-1 text-xs font-semibold"
          style={{ color: senderColour(senderName) }}
        >
          {senderName}
        </Text>
      )}

      <View className={`rounded-2xl px-3 py-2 ${bubbleStyle}`}>
        {message.type === 'location' && message.locationPayload ? (
          <LocationCard location={message.locationPayload} />
        ) : (
          <Text
            className={`text-sm leading-5 ${isMine ? 'text-white' : 'text-text-50'}`}
          >
            {message.decryptedContent ?? '🔒'}
          </Text>
        )}
      </View>

      <Text className={`mt-0.5 text-[10px] text-text-800 ${timeStyle}`}>
        {formatTime(message.sentAt)}
      </Text>
    </View>
  );
}
