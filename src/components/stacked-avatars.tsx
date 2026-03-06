import React from 'react';
import { View } from 'react-native';

import { PersonAvatar } from '@/components/person-avatar';
import { colors, Text } from '@/components/ui';
import type { EventIdT, UserIdT } from '@/types';

const DEFAULT_MAX_COUNT = 4;

type Props = {
  userIds: UserIdT[];
  eventId: EventIdT;
  maxCount?: number;
  size?: 'sm' | 'md' | 'lg';
  avatarBorderClassName?: string;
  overflowBadgeClassName?: string;
  suffixText?: string;
};

export function StackedAvatars({
  userIds,
  eventId,
  maxCount = DEFAULT_MAX_COUNT,
  size = 'sm',
  avatarBorderClassName = 'border-2 border-background-950',
  overflowBadgeClassName = 'border-2 border-background-950 bg-neutral-850',
  suffixText,
}: Props) {
  const visible = userIds.slice(0, maxCount);
  const additionalCount = Math.max(0, userIds.length - maxCount);

  return (
    <View className="flex-row items-center">
      {visible.map((userId, index) => (
        <View
          key={userId}
          className={`rounded-full ${avatarBorderClassName}`}
          style={index > 0 ? { marginLeft: -8 } : undefined}
        >
          <PersonAvatar userId={userId} eventId={eventId} size={size} />
        </View>
      ))}
      {additionalCount > 0 && (
        <View
          className={`size-6 items-center justify-center rounded-full ${overflowBadgeClassName}`}
          style={{ marginLeft: -8 }}
        >
          <Text className="text-xs font-medium text-neutral-900">
            +{additionalCount}
          </Text>
        </View>
      )}
      {suffixText != null && suffixText !== '' && (
        <Text className="ml-2 text-sm" style={{ color: colors.text[800] }}>
          {suffixText}
        </Text>
      )}
    </View>
  );
}
