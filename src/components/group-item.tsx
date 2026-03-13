import Feather from '@expo/vector-icons/Feather';
import Octicons from '@expo/vector-icons/Octicons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { StackedAvatars } from '@/components/stacked-avatars';
import { colors, Text, View } from '@/components/ui';
import type { EventIdT, UserIdT } from '@/types';

export type GroupItemData = {
  id: string;
  title: string;
  hasUnreadIndicator: boolean;
  eventDescription: string;
  displayDate: string;
  memberIds: UserIdT[];
  primaryEventId: EventIdT;
  isPinned: boolean;
};

const VISIBLE_AVATAR_COUNT = 4;
const SWIPE_THRESHOLD = 60;

type Props = {
  group: GroupItemData;
  onPinToggle?: (groupId: string) => void;
  onPress?: (groupId: string) => void;
};

export function GroupItem({ group, onPinToggle, onPress }: Props) {
  const translateX = useSharedValue(0);

  const ACTION_PANEL_WIDTH = 80;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, -ACTION_PANEL_WIDTH);
      }
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD && onPinToggle) {
        scheduleOnRN(onPinToggle, group.id);
      }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const content = (
    <View className="bg-background-950 py-2">
      <View className="flex-row items-start">
        <View className="mr-2 w-2 shrink-0 items-center justify-center pt-8">
          {group.hasUnreadIndicator && (
            <View className="size-2 rounded-full bg-neutral-400" />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text
              className="flex-1 font-futura text-3xl text-white"
              numberOfLines={1}
            >
              {group.title}
            </Text>
            <View className="shrink-0 items-end gap-1">
              <Text className="text-xs" style={{ color: colors.text[800] }}>
                {group.displayDate}
              </Text>
              <StackedAvatars
                userIds={group.memberIds}
                eventId={group.primaryEventId}
                maxCount={VISIBLE_AVATAR_COUNT}
              />
            </View>
          </View>
          <View className="mt-1 flex-row items-center gap-2">
            {group.eventDescription ? (
              <Feather
                name="alert-circle"
                size={14}
                color={colors.accent[100]}
              />
            ) : null}
            <Text className="text-sm" style={{ color: colors.text[800] }}>
              {group.eventDescription || 'No upcoming events'}
            </Text>
          </View>
        </View>
        <View className="ml-2 w-6 shrink-0 items-center justify-center pt-7">
          {group.isPinned && (
            <Octicons name="pin" size={16} color={colors.text[800]} />
          )}
        </View>
      </View>
    </View>
  );

  const handlePress = () => {
    if (onPress) {
      onPress(group.id);
    } else {
      router.push(`/group/${group.id}` as const);
    }
  };

  if (onPinToggle) {
    const actionLabel = group.isPinned ? 'Unpin' : 'Pin';
    return (
      <Pressable onPress={handlePress}>
        <View className="overflow-hidden border-b border-neutral-700">
          <View
            className="absolute right-0 top-0 h-full items-center justify-center bg-neutral-800"
            style={{ width: ACTION_PANEL_WIDTH }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: colors.text[800] }}
            >
              {actionLabel}
            </Text>
          </View>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={animatedStyle}>{content}</Animated.View>
          </GestureDetector>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress}>
      <View className="border-b border-neutral-700">{content}</View>
    </Pressable>
  );
}
