import * as React from 'react';
import { Pressable, ScrollView } from 'react-native';

import { colors, Text } from '@/components/ui';

type Props = {
  reactions: Record<string, string[]>;
  currentUserId: string;
  onToggle: (emoji: string) => void;
};

export function ReactionPills({ reactions, currentUserId, onToggle }: Props) {
  const entries = Object.entries(reactions).filter(
    ([, users]) => users.length > 0
  );
  if (entries.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 4, paddingTop: 4 }}
    >
      {entries.map(([emoji, users]) => {
        const isMine = users.includes(currentUserId);
        return (
          <Pressable
            key={emoji}
            onPress={() => onToggle(emoji)}
            accessibilityLabel={`${emoji} reaction, ${users.length} ${users.length === 1 ? 'person' : 'people'}`}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3,
              gap: 4,
              backgroundColor: isMine
                ? colors.primary[700]
                : colors.background[900],
              borderWidth: 1,
              borderColor: isMine
                ? colors.primary[500]
                : colors.background[900],
            }}
          >
            <Text style={{ fontSize: 13 }}>{emoji}</Text>
            <Text
              style={{
                fontSize: 11,
                color: isMine ? '#fff' : colors.text[800],
                fontWeight: '600',
              }}
            >
              {users.length}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
