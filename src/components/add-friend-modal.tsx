import Octicons from '@expo/vector-icons/Octicons';
import { type QueryClient, useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { fetchUsersBatch, useUserIds } from '@/api/people/use-users';
import {
  FriendRequestConflictError,
  sendFriendRequest,
} from '@/api/social/friend-requests';
import { useFriendUserIds } from '@/api/social/friendships';
import { PersonAvatar } from '@/components/person-avatar';
import { ActivityIndicator, colors, Pressable, Text } from '@/components/ui';
import { topSoftMatches } from '@/lib/soft-match';
import type { UserIdT, UserWithId } from '@/types';

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

  const { data: allUserIds = [], isPending: isUserIdsPending } = useUserIds();
  const { data: friendUserIds = [] } = useFriendUserIds({
    variables: userId,
    enabled: Boolean(userId) && userId !== 'guest_user',
  });

  const { data: searchPoolUsers = [], isPending: isBatchPending } = useQuery({
    queryKey: ['users', 'batch', 'addFriendSearch', allUserIds, userId],
    queryFn: () => fetchUsersBatch(allUserIds as UserIdT[]),
    enabled:
      isOpen &&
      Boolean(userId) &&
      userId !== 'guest_user' &&
      allUserIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isPoolLoading = isUserIdsPending || isBatchPending;

  const eligibleUsers = useMemo((): UserWithId[] => {
    const excluded = new Set<string>();
    if (userId) excluded.add(userId);
    for (const id of friendUserIds) excluded.add(id);
    return searchPoolUsers.filter((u) => !excluded.has(u.id));
  }, [searchPoolUsers, userId, friendUserIds]);

  const topMatches = useMemo(
    () => topSoftMatches(friendUsername, eligibleUsers, 3),
    [friendUsername, eligibleUsers]
  );

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

  const sendFriendRequestToUsername = useCallback(
    async (rawUsername: string) => {
      const candidate = normalizeFriendUsernameInput(rawUsername);
      if (!candidate) {
        setAddFriendError('Enter a username');
        return;
      }

      if (userId === null) {
        setAddFriendError('Sign in to add friends.');
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
          fromUserId: userId,
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
    },
    [dismissAddFriendModal, normalizeFriendUsernameInput, queryClient, userId]
  );

  const handleSendFriendRequest = useCallback(async () => {
    await sendFriendRequestToUsername(friendUsername);
  }, [friendUsername, sendFriendRequestToUsername]);

  const searchTrimmed = friendUsername.trim();
  const showSuggestions =
    Boolean(searchTrimmed) && !isPoolLoading && !addFriendSubmitting;

  return (
    <View className="w-full max-w-md self-center rounded-3xl bg-background-900 p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-text-50">Add Friend</Text>
        <Pressable onPress={dismissAddFriendModal}>
          <Octicons name="x" size={22} color={colors.text[800]} />
        </Pressable>
      </View>

      <View
        className={`bg-background-800 mb-3 flex-row items-center rounded-2xl border px-3 ${
          addFriendError ? 'border-danger-500' : 'border-neutral-700'
        }`}
      >
        <Octicons name="search" size={18} color={colors.text[800]} />
        <TextInput
          value={friendUsername}
          onChangeText={handleFriendUsernameChange}
          placeholder="Search by name or username..."
          placeholderTextColor={colors.text[800]}
          className="flex-1 px-3 py-3.5 text-base text-text-50"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!addFriendSubmitting}
        />
      </View>

      <ScrollView
        className="mb-3"
        style={{ maxHeight: 280 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isPoolLoading && isOpen ? (
          <View className="mb-1 flex-row items-center gap-2 py-2">
            <ActivityIndicator color={colors.text[800]} />
            <Text className="text-sm" style={{ color: colors.text[800] }}>
              Loading people…
            </Text>
          </View>
        ) : null}

        {showSuggestions ? (
          <View>
            {topMatches.length > 0 ? (
              topMatches.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => void sendFriendRequestToUsername(u.username)}
                  disabled={addFriendSubmitting}
                  className="bg-background-800 mb-2 flex-row items-center justify-between rounded-2xl border border-neutral-700 px-3 py-2.5 active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel={`Send friend request to ${u.displayName}`}
                >
                  <View className="flex-row items-center">
                    <PersonAvatar userId={u.id} size="sm" />
                    <View className="ml-3">
                      <Text className="text-base text-text-50">
                        {u.displayName}
                      </Text>
                      {u.username ? (
                        <Text className="text-xs text-gray-400">
                          @{u.username}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Octicons
                    name="person-add"
                    size={18}
                    color={colors.text[800]}
                  />
                </Pressable>
              ))
            ) : (
              <Text
                className="py-2 text-center text-sm"
                style={{ color: colors.text[800] }}
              >
                No matching users
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View className="mb-4 min-h-[22px] justify-center">
        {addFriendError ? (
          <Text className="text-sm text-danger-500">{addFriendError}</Text>
        ) : null}
      </View>

      <Pressable
        className="h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-accent-100 bg-background-950 opacity-100 disabled:opacity-50"
        onPress={() => void handleSendFriendRequest()}
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
