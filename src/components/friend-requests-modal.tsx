import Octicons from '@expo/vector-icons/Octicons';
import React from 'react';
import { View } from 'react-native';

import { PersonAvatar } from '@/components/person-avatar';
import { ActivityIndicator, colors, Pressable, Text } from '@/components/ui';
import type { IncomingFriendRequestRow } from '@/lib/hooks/use-incoming-friend-request-rows';
import type { UserIdT } from '@/types';

export type FriendRequestsModalProps = {
  incomingRows: IncomingFriendRequestRow[];
  onClose: () => void;
  onAcceptRequest: (requestId: string) => void;
  onDeclineRequest: (requestId: string) => void;
  acceptPending: boolean;
  declinePending: boolean;
  acceptingRequestId: string | undefined;
  decliningRequestId: string | undefined;
};

export function FriendRequestsModal({
  incomingRows,
  onClose,
  onAcceptRequest,
  onDeclineRequest,
  acceptPending,
  declinePending,
  acceptingRequestId,
  decliningRequestId,
}: FriendRequestsModalProps) {
  return (
    <View className="rounded-3xl bg-background-900 p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-text-50">Friend Requests</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close friend requests"
        >
          <Octicons name="x" size={22} color={colors.text[800]} />
        </Pressable>
      </View>

      {incomingRows.length === 0 ? (
        <Text
          className="py-4 text-center text-base"
          style={{ color: colors.text[800] }}
        >
          No pending friend requests
        </Text>
      ) : (
        incomingRows.map((request, idx) => {
          const busy = acceptPending || declinePending;
          return (
            <View
              key={request.id}
              className={`flex-row items-center justify-between py-3.5 ${
                idx < incomingRows.length - 1
                  ? 'border-b border-neutral-700'
                  : ''
              }`}
            >
              <View className="flex-row items-center gap-3">
                <PersonAvatar
                  userId={request.fromUserId as UserIdT}
                  size="lg"
                />
                <View>
                  <Text className="text-lg font-semibold text-text-50">
                    {request.displayName}
                  </Text>
                  <Text className="text-text-700 text-sm">
                    {request.handle}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <Pressable
                  className="size-10 items-center justify-center rounded-full bg-white"
                  disabled={busy}
                  onPress={() => onAcceptRequest(request.id)}
                  accessibilityLabel={`Accept friend request from ${request.displayName}`}
                  accessibilityRole="button"
                >
                  {acceptPending && acceptingRequestId === request.id ? (
                    <ActivityIndicator size="small" color="#0A0A0A" />
                  ) : (
                    <Octicons name="check" size={18} color="#0A0A0A" />
                  )}
                </Pressable>
                <Pressable
                  className="bg-background-800 size-10 items-center justify-center rounded-full"
                  disabled={busy}
                  onPress={() => onDeclineRequest(request.id)}
                  accessibilityLabel={`Decline friend request from ${request.displayName}`}
                  accessibilityRole="button"
                >
                  {declinePending && decliningRequestId === request.id ? (
                    <ActivityIndicator size="small" color={colors.text[800]} />
                  ) : (
                    <Octicons name="x" size={18} color={colors.text[800]} />
                  )}
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
