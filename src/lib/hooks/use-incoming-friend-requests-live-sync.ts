import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getKey } from 'react-query-kit';

import {
  INCOMING_FRIEND_REQUESTS_QUERY_KEY,
  subscribePendingIncomingFriendRequests,
} from '@/api/social/friend-requests';
import type { UserIdT } from '@/types';

/**
 * Keeps the `useIncomingFriendRequests` React Query cache in sync via Firestore `onSnapshot`.
 * Call from a long-lived layout (e.g. app tabs) while signed in.
 */
export function useIncomingFriendRequestsLiveSync(
  userId: UserIdT | null
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || userId === 'guest_user') return;

    const unsubscribe = subscribePendingIncomingFriendRequests(
      userId,
      (rows) => {
        queryClient.setQueryData(
          getKey(INCOMING_FRIEND_REQUESTS_QUERY_KEY, userId),
          rows
        );
      },
      (error) => {
        console.error('[friend-requests] incoming onSnapshot error', error);
      }
    );

    return unsubscribe;
  }, [userId, queryClient]);
}
