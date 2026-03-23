import Octicons from '@expo/vector-icons/Octicons';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { fetchEvent } from '@/api/events/use-events';
import { fetchGroup, useGroupIds } from '@/api/groups/use-groups';
import { fetchUser } from '@/api/people/use-users';
import {
  acceptFriendRequest,
  declineFriendRequest,
  INCOMING_FRIEND_REQUESTS_QUERY_KEY,
  useIncomingFriendRequests,
} from '@/api/social/friend-requests';
import { unfriendUser, useFriendUserIds } from '@/api/social/friendships';
import { AddFriendModal } from '@/components/add-friend-modal';
import { FriendListItem } from '@/components/friend-list-item';
import { FriendRequestsModal } from '@/components/friend-requests-modal';
import { GroupItem, type GroupItemData } from '@/components/group-item';
import { RemoveFriendModal } from '@/components/remove-friend-modal';
import { colors, Pressable, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatCreationDate, formatEventDescription } from '@/lib/date-utils';
import { getMostRelevantEventId } from '@/lib/event-utils';
import { useGroupPreferences } from '@/lib/group-preferences';
import { useIncomingFriendRequestRows } from '@/lib/hooks/use-incoming-friend-request-rows';
import type { EventIdT, EventWithId, UserIdT } from '@/types';

const PIN_LAYOUT_TRANSITION = LinearTransition.springify()
  .damping(40)
  .stiffness(200)
  .overshootClamping(200);

/** Which pane is visible on the Social tab: group list vs friends list */
type SocialSegment = 'groupList' | 'friends';

export default function Social() {
  const queryClient = useQueryClient();
  const userId = useAuth.use.userId();
  const pinnedGroupIds = useGroupPreferences.use.pinnedGroupIds();
  const unreadGroupIds = useGroupPreferences.use.unreadGroupIds();
  const togglePin = useGroupPreferences.use.togglePin();
  const [isLayoutAnimationReady, setIsLayoutAnimationReady] = useState(false);
  const [activeSegment, setActiveSegment] = useState<SocialSegment>('friends');
  const [isFriendRequestsOpen, setIsFriendRequestsOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [removeFriendTarget, setRemoveFriendTarget] = useState<{
    id: UserIdT;
    displayName: string;
  } | null>(null);

  const { data: groupIds = [] } = useGroupIds({
    variables: userId,
  });

  const { data: friendUserIds = [] } = useFriendUserIds({
    variables: userId,
    enabled: Boolean(userId) && userId !== 'guest_user',
  });

  const { data: incomingFriendRequests = [] } = useIncomingFriendRequests({
    variables: userId,
    enabled: Boolean(userId) && userId !== 'guest_user',
  });

  const incomingRows = useIncomingFriendRequestRows(incomingFriendRequests);
  const refreshFriendList = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['friendships', 'friendIds'] });
  }, [queryClient]);
  const invalidateFriendCaches = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: INCOMING_FRIEND_REQUESTS_QUERY_KEY,
    });
    queryClient.invalidateQueries({ queryKey: ['friendships', 'friendIds'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }, [queryClient]);

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) =>
      acceptFriendRequest({
        requestId,
        currentUserId: userId as UserIdT,
      }),
    onSuccess: () => {
      invalidateFriendCaches();
    },
    onError: (e: Error) => {
      Alert.alert('Could not accept', e.message);
    },
  });

  const declineMutation = useMutation({
    mutationFn: (requestId: string) =>
      declineFriendRequest({
        requestId,
        currentUserId: userId as UserIdT,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
    onError: (e: Error) => {
      Alert.alert('Could not decline', e.message);
    },
  });

  const groupQueries = useQueries({
    queries: groupIds.map((id) => ({
      queryKey: ['groups', 'groupId', id] as const,
      queryFn: () => fetchGroup(id),
    })),
  });

  const userGroups = groupQueries
    .map((q) => q.data)
    .filter((g): g is NonNullable<typeof g> => g != null);

  const friendUserQueries = useQueries({
    queries: friendUserIds.map((id) => ({
      queryKey: ['users', 'userId', id] as const,
      queryFn: () => fetchUser(id),
      enabled: friendUserIds.length > 0,
    })),
  });

  const allEventIds = useMemo(
    () => [...new Set(userGroups.flatMap((g) => g.events))],
    [userGroups]
  );

  const eventQueries = useQueries({
    queries: allEventIds.map((id) => ({
      queryKey: ['events', 'eventId', id] as const,
      queryFn: () => fetchEvent(id as EventIdT),
    })),
  });

  const eventMap = useMemo(() => {
    const map = new Map<string, EventWithId>();
    allEventIds.forEach((id, i) => {
      const event = eventQueries[i]?.data;
      if (event) map.set(id, event);
    });
    return map;
  }, [allEventIds, eventQueries]);

  const handlePinToggle = useCallback(
    (groupId: string) => {
      togglePin(groupId);
    },
    [togglePin]
  );

  const groupItems = useMemo((): GroupItemData[] => {
    return userGroups
      .map((g) => {
        const primaryEventId =
          getMostRelevantEventId(g.events, eventMap) ?? undefined;
        const event = primaryEventId ? eventMap.get(primaryEventId) : undefined;
        const eventDescription = event
          ? formatEventDescription(event.name, event.startDate)
          : '';

        const isPinned = pinnedGroupIds.includes(g.id);
        const hasUnread = unreadGroupIds.includes(g.id) && g.events.length > 0;

        return {
          id: g.id,
          title: g.name,
          hasUnreadIndicator: hasUnread,
          eventDescription,
          displayDate: formatCreationDate(g.createdAt),
          memberIds: g.members as UserIdT[],
          primaryEventId,
          isPinned,
        };
      })
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  }, [userGroups, eventMap, pinnedGroupIds, unreadGroupIds]);

  const friendItems = useMemo(() => {
    return friendUserQueries
      .map((q) => q.data)
      .filter((u): u is NonNullable<typeof u> => u != null)
      .map((u, index) => {
        const username = u.username?.trim();
        return {
          id: u.id,
          displayName: u.displayName || 'Unknown',
          handle: `@${username || u.id}`,
          isOnline: index % 2 === 0,
        };
      });
  }, [friendUserQueries]);

  const handleSwipeRemoveRequest = useCallback(
    (friendId: UserIdT) => {
      const friend = friendItems.find((f) => f.id === friendId);
      if (!friend) return;
      setRemoveFriendTarget({ id: friend.id, displayName: friend.displayName });
    },
    [friendItems]
  );

  const unfriendMutation = useMutation({
    mutationFn: (friendUserId: UserIdT) =>
      unfriendUser({
        currentUserId: userId as UserIdT,
        friendUserId,
      }),
    onSuccess: () => {
      invalidateFriendCaches();
      setRemoveFriendTarget(null);
    },
    onError: (e: Error) => {
      Alert.alert('Could not remove friend', e.message);
    },
  });

  const confirmRemoveFriend = useCallback(() => {
    if (!removeFriendTarget) return;
    unfriendMutation.mutate(removeFriendTarget.id);
  }, [removeFriendTarget, unfriendMutation]);

  const openAddFriendModal = useCallback(() => {
    setIsAddFriendOpen(true);
  }, []);

  const dismissAddFriendModal = useCallback(() => {
    setIsAddFriendOpen(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId && userId !== 'guest_user') {
        invalidateFriendCaches();
      }
      setIsLayoutAnimationReady(false);
      const id = setTimeout(() => setIsLayoutAnimationReady(true), 250);
      return () => clearTimeout(id);
    }, [invalidateFriendCaches, userId])
  );

  return (
    <View className="flex-1 px-4">
      <Stack.Screen
        options={{
          title: 'Social',
          headerRight: () => {
            const pendingCount = incomingFriendRequests.length;
            const showRequestBadge =
              activeSegment === 'friends' && pendingCount > 0;

            return (
              <View className="mr-4 flex-row items-center gap-4">
                <Pressable
                  onPress={() => {
                    if (activeSegment === 'friends') {
                      setIsFriendRequestsOpen(true);
                      return;
                    }
                    router.push('/notifications');
                  }}
                  accessibilityLabel={
                    activeSegment === 'friends' && pendingCount > 0
                      ? `Friend requests, ${pendingCount} pending`
                      : 'Notifications'
                  }
                  accessibilityRole="button"
                >
                  <View className="relative">
                    <Octicons name="bell" size={24} color={colors.text[800]} />
                    {showRequestBadge ? (
                      pendingCount > 1 ? (
                        <View className="absolute -right-1 -top-1 min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1">
                          <Text className="text-[10px] font-bold leading-none text-white">
                            {pendingCount > 9 ? '9+' : String(pendingCount)}
                          </Text>
                        </View>
                      ) : (
                        <View className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-red-500" />
                      )
                    ) : null}
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (activeSegment === 'friends') {
                      openAddFriendModal();
                      return;
                    }
                    router.push('/group/edit');
                  }}
                  accessibilityLabel="Create group"
                  accessibilityRole="button"
                >
                  <Octicons name="plus" size={24} color={colors.text[800]} />
                </Pressable>
              </View>
            );
          },
        }}
      />

      <View className="mb-3 mt-2 rounded-2xl bg-background-900 p-1">
        <View className="flex-row">
          <Pressable
            onPress={() => {
              setActiveSegment('groupList');
            }}
            className={`flex-1 items-center rounded-xl py-2.5 ${
              activeSegment === 'groupList'
                ? 'bg-background-950'
                : 'bg-transparent'
            }`}
            accessibilityRole="button"
            accessibilityState={{ selected: activeSegment === 'groupList' }}
          >
            <Text
              className={`text-sm font-semibold ${
                activeSegment === 'groupList' ? 'text-text-50' : 'text-text-800'
              }`}
            >
              Groups
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setActiveSegment('friends');
              if (userId && userId !== 'guest_user') {
                refreshFriendList();
              }
            }}
            className={`flex-1 items-center rounded-xl py-2.5 ${
              activeSegment === 'friends'
                ? 'bg-background-950'
                : 'bg-transparent'
            }`}
            accessibilityRole="button"
            accessibilityState={{ selected: activeSegment === 'friends' }}
          >
            <Text
              className={`text-sm font-semibold ${
                activeSegment === 'friends' ? 'text-text-50' : 'text-text-800'
              }`}
            >
              Friends
            </Text>
          </Pressable>
        </View>
      </View>

      {activeSegment === 'groupList' ? (
        <>
          <Text
            className="py-2 text-center text-xs"
            style={{ color: colors.text[800] }}
          >
            Swipe left to pin
          </Text>
          <View className="border-b border-neutral-700" />
          <FlashList
            data={groupItems}
            renderItem={({ item }) => (
              <Animated.View
                layout={
                  isLayoutAnimationReady ? PIN_LAYOUT_TRANSITION : undefined
                }
              >
                <GroupItem group={item} onPinToggle={handlePinToggle} />
              </Animated.View>
            )}
            keyExtractor={(item) => item.id}
          />
        </>
      ) : (
        <>
          <Pressable
            className="mb-1 flex-row items-center gap-3 py-3"
            onPress={openAddFriendModal}
          >
            <View className="size-11 items-center justify-center rounded-full border border-dashed border-neutral-600">
              <Octicons name="person-add" size={18} color={colors.text[800]} />
            </View>
            <Text className="text-text-300 text-base font-medium">
              Add by username
            </Text>
          </Pressable>
          <Text
            className="py-1 text-center text-xs"
            style={{ color: colors.text[800] }}
          >
            Swipe left to remove
          </Text>
          <View className="border-b border-neutral-800" />
          <FlashList
            data={friendItems}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text
                className="py-8 text-center text-sm"
                style={{ color: colors.text[800] }}
              >
                No friends yet. Add someone by username to send a request.
              </Text>
            }
            renderItem={({ item }) => (
              <FriendListItem
                friend={item}
                onSwipeRemoveRequest={handleSwipeRemoveRequest}
              />
            )}
          />
        </>
      )}
      {(isFriendRequestsOpen ||
        isAddFriendOpen ||
        removeFriendTarget != null) && (
        <View className="absolute inset-0 z-50 justify-center bg-black/60 px-4">
          <Pressable
            className="absolute inset-0"
            onPress={() => {
              if (unfriendMutation.isPending) return;
              setIsFriendRequestsOpen(false);
              setIsAddFriendOpen(false);
              setRemoveFriendTarget(null);
            }}
          />

          {removeFriendTarget ? (
            <RemoveFriendModal
              displayName={removeFriendTarget.displayName}
              onCancel={() => setRemoveFriendTarget(null)}
              onConfirm={confirmRemoveFriend}
              isUnfriendPending={unfriendMutation.isPending}
            />
          ) : isFriendRequestsOpen ? (
            <FriendRequestsModal
              incomingRows={incomingRows}
              onClose={() => setIsFriendRequestsOpen(false)}
              onAcceptRequest={(requestId) => acceptMutation.mutate(requestId)}
              onDeclineRequest={(requestId) =>
                declineMutation.mutate(requestId)
              }
              acceptPending={acceptMutation.isPending}
              declinePending={declineMutation.isPending}
              acceptingRequestId={acceptMutation.variables}
              decliningRequestId={declineMutation.variables}
            />
          ) : isAddFriendOpen ? (
            <AddFriendModal
              isOpen={isAddFriendOpen}
              onDismiss={dismissAddFriendModal}
              userId={userId}
              queryClient={queryClient}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}
