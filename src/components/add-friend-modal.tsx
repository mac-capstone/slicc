import Octicons from '@expo/vector-icons/Octicons';
import type { QueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import {
  FriendRequestConflictError,
  sendFriendRequest,
} from '@/api/social/friend-requests';
import { ActivityIndicator, colors, Pressable, Text } from '@/components/ui';
import type { UserIdT } from '@/types';

export type AddFriendModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
  userId: UserIdT | null;
  queryClient: QueryClient;
};

export function AddFriendModal({
  isOpen,
  onDismiss,
  userId,
  queryClient,
}: AddFriendModalProps) {
  const [friendUsername, setFriendUsername] = useState('');
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [addFriendSubmitting, setAddFriendSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFriendUsername('');
    setAddFriendError(null);
    setAddFriendSubmitting(false);
  }, [isOpen]);

  const normalizeFriendUsernameInput = useCallback((raw: string) => {
    const trimmed = raw.trim();
    const withoutAt = trimmed.startsWith('@')
      ? trimmed.slice(1).trim()
      : trimmed;
    return withoutAt;
  }, []);

  const handleFriendUsernameChange = useCallback((text: string) => {
    setFriendUsername(text);
    setAddFriendError(null);
  }, []);

  const resetAddFriendForm = useCallback(() => {
    setFriendUsername('');
    setAddFriendError(null);
    setAddFriendSubmitting(false);
  }, []);

  const dismissAddFriendModal = useCallback(() => {
    resetAddFriendForm();
    onDismiss();
  }, [onDismiss, resetAddFriendForm]);

  const handleSendFriendRequest = useCallback(async () => {
    const candidate = normalizeFriendUsernameInput(friendUsername);
    if (!candidate) {
      setAddFriendError('Enter a username');
      return;
    }
    if (userId === 'guest_user') {
      setAddFriendError('Sign in to add friends.');
      return;
    }

    setAddFriendSubmitting(true);
    setAddFriendError(null);
    try {
      await sendFriendRequest({
        fromUserId: userId as UserIdT,
        toUsername: candidate,
      });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friendships'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      dismissAddFriendModal();
    } catch (e) {
      if (e instanceof FriendRequestConflictError) {
        setAddFriendError(e.message);
      } else {
        setAddFriendError('Could not send request. Try again.');
      }
    } finally {
      setAddFriendSubmitting(false);
    }
  }, [
    dismissAddFriendModal,
    friendUsername,
    normalizeFriendUsernameInput,
    queryClient,
    userId,
  ]);

  return (
    <View className="rounded-3xl bg-background-900 p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-text-50">Add Friend</Text>
        <Pressable onPress={dismissAddFriendModal}>
          <Octicons name="x" size={22} color={colors.text[800]} />
        </Pressable>
      </View>

      <View
        className={`bg-background-800 mb-1 flex-row items-center rounded-2xl border px-3 ${
          addFriendError ? 'border-danger-500' : 'border-neutral-700'
        }`}
      >
        <Octicons name="search" size={18} color={colors.text[800]} />
        <TextInput
          value={friendUsername}
          onChangeText={handleFriendUsernameChange}
          placeholder="Enter username..."
          placeholderTextColor={colors.text[800]}
          className="flex-1 px-3 py-3.5 text-base text-text-50"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!addFriendSubmitting}
        />
      </View>
      <View className="mb-4 min-h-[22px] justify-center">
        {addFriendError ? (
          <Text className="text-sm text-danger-500">{addFriendError}</Text>
        ) : null}
      </View>

      <Pressable
        className="h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-accent-100 bg-background-950 opacity-100 disabled:opacity-50"
        onPress={handleSendFriendRequest}
        disabled={addFriendSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Send friend request"
      >
        {addFriendSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Octicons name="person-add" size={16} color={colors.white} />
            <Text className="text-base font-semibold text-white">
              Send Friend Request
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
