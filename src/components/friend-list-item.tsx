import React from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PersonAvatar } from '@/components/person-avatar';
import { colors, Text, View } from '@/components/ui';
import type { UserIdT } from '@/types';

export type FriendListItemData = {
  id: UserIdT;
  displayName: string;
  handle: string;
  isOnline: boolean;
};

const SWIPE_THRESHOLD = 60;
const ACTION_PANEL_WIDTH = 80;

type Props = {
  friend: FriendListItemData;
  onSwipeRemoveRequest: (friendId: UserIdT) => void;
};

export function FriendListItem({ friend, onSwipeRemoveRequest }: Props) {
  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, -ACTION_PANEL_WIDTH);
      }
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        scheduleOnRN(onSwipeRemoveRequest, friend.id);
      }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const content = (
    <View className="bg-background-950 py-3.5">
      <View className="flex-row items-center gap-3">
        <View className="relative">
          <PersonAvatar userId={friend.id} size="lg" />
          {friend.isOnline && (
            <View className="absolute bottom-0 left-0 size-3 rounded-full border border-background-950 bg-emerald-500" />
          )}
        </View>
        <View>
          <Text className="text-lg font-semibold text-text-50">
            {friend.displayName}
          </Text>
          <Text className="text-text-700 text-sm">{friend.handle}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View className="overflow-hidden border-b border-neutral-800">
      <View
        className="absolute right-0 top-0 h-full items-center justify-center bg-neutral-800"
        style={{ width: ACTION_PANEL_WIDTH }}
      >
        <Text
          className="text-sm font-medium"
          style={{ color: colors.text[800] }}
        >
          Remove
        </Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={animatedStyle}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${friend.displayName}, ${friend.handle}`}
          accessibilityHint="Swipe left to remove this friend"
        >
          {content}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
