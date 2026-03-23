import React from 'react';
import { View } from 'react-native';

import { ActivityIndicator, colors, Pressable, Text } from '@/components/ui';

export type RemoveFriendModalProps = {
  displayName: string;
  onCancel: () => void;
  onConfirm: () => void;
  isUnfriendPending: boolean;
};

export function RemoveFriendModal({
  displayName,
  onCancel,
  onConfirm,
  isUnfriendPending,
}: RemoveFriendModalProps) {
  return (
    <View className="rounded-3xl bg-background-900 p-5">
      <Text className="mb-2 text-xl font-bold text-text-50">
        Remove friend?
      </Text>
      <Text className="mb-5 text-base" style={{ color: colors.text[800] }}>
        {displayName} will be removed from your friends list. You can add them
        again later if you change your mind.
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          className="h-12 flex-1 items-center justify-center rounded-2xl border border-neutral-600"
          onPress={onCancel}
          disabled={isUnfriendPending}
          accessibilityRole="button"
          accessibilityLabel="Cancel remove friend"
        >
          <Text className="text-base font-semibold text-text-50">Cancel</Text>
        </Pressable>
        <Pressable
          className="h-12 flex-1 items-center justify-center rounded-2xl bg-red-600 disabled:opacity-50"
          onPress={onConfirm}
          disabled={isUnfriendPending}
          accessibilityRole="button"
          accessibilityLabel="Confirm remove friend"
        >
          {isUnfriendPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text className="text-base font-semibold text-white">Remove</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
