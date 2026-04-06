import * as React from 'react';
import { Pressable, ScrollView } from 'react-native';

import { colors, Text } from '@/components/ui';

type Props = {
  reactions: Record<string, string[]>;
  currentUserId: string;
  onToggle: (emoji: string) => void;
};

export function ReactionPills({ reactions, currentUserId, onToggle }: Props) {
  const entries = Object.entries(reactions)
    .filter(([, users]) => users.length > 0)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  if (entries.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row', paddingTop: 4 }}
    >
      {entries.map(([emoji, users], index) => {
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
              marginRight: index < entries.length - 1 ? 4 : 0,
              minHeight: 28,
              backgroundColor: isMine ? colors.accent[200] : colors.accent[900],
              borderWidth: 1,
              borderColor: isMine ? colors.accent[100] : colors.accent[200],
            }}
          >
            <Text style={{ fontSize: 13 }}>{emoji}</Text>
            <Text
              style={{
                fontSize: 11,
                minWidth: 16,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
                color: colors.text[50],
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
